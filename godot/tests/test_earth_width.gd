extends SceneTree

var WorldScript = load("res:/" + "/scripts/adventure_world.gd")
var Maze = load("res:/" + "/scripts/adventure_maze.gd")
var checks: int = 0
var failures: int = 0
var swept_legs: int = 0

class TrialState extends Node:
	signal inventory_changed
	signal progression_changed
	var current_floor: int = 0
	var checkpoint_floor: int = 0
	var checkpoint_cell: Vector2i = Vector2i(1, 1)
	var items: Dictionary = {}
	var flags: Dictionary = {}
	var equipped_weapon: String = "driftwood"
	var save_calls: int = 0
	var restock_calls: int = 0
	func has_item(id: String) -> bool:
		return items.has(id)
	func acquire_item(id: String) -> void:
		items[id] = true
		inventory_changed.emit()
	func has_flag(index: int, id: String) -> bool:
		return bool(flags.get(index, {}).get(id, false))
	func set_flag(index: int, id: String, value: bool = true) -> void:
		if not flags.has(index):
			flags[index] = {}
		flags[index][id] = value
		progression_changed.emit()
	func set_checkpoint(index: int, cell: Vector2i) -> void:
		checkpoint_floor = index
		checkpoint_cell = cell
	func restock_at_checkpoint() -> void:
		restock_calls += 1
	func save_game() -> bool:
		save_calls += 1
		return true
	func can_travel_to(_index: int) -> bool:
		return true
	func tool_level(_id: String) -> int:
		return 1

class TrialHero extends CharacterBody3D:
	var camera: Camera3D
	var healed: bool = false
	func _ready() -> void:
		collision_layer = 4
		collision_mask = 3
		var shape = CollisionShape3D.new()
		var capsule = CapsuleShape3D.new()
		capsule.radius = 0.32
		capsule.height = 1.7
		shape.shape = capsule
		shape.position.y = 0.85
		add_child(shape)
		camera = Camera3D.new()
		camera.position.y = 1.52
		add_child(camera)
	func heal_to_full() -> void:
		healed = true

func _initialize() -> void:
	call_deferred("_run")

func expect(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		push_error("EARTH WIDTH TEST FAILED: " + label)

func _ray(world: Node, origin: Vector3, endpoint: Vector3) -> Dictionary:
	var query = PhysicsRayQueryParameters3D.create(origin, endpoint, 9)
	return world.get_world_3d().direct_space_state.intersect_ray(query)

func _test_gate(world: Node, state: TrialState, hero: TrialHero, id: String, flag: String) -> void:
	var gate: Node3D = world.get_feature(id)
	var center: Vector3 = world.cell_to_world(gate.data["cell"]) + Vector3(0, 0.08, 0)
	var normal: Vector3 = gate.global_transform.basis.z.normalized()
	var tangent: Vector3 = gate.global_transform.basis.x.normalized()
	for offset in [-4.1, 0.0, 4.1]:
		var start: Vector3 = center - normal * 6.0 + tangent * offset
		expect(hero.test_move(Transform3D(Basis.IDENTITY, start), normal * 12.0), id + " closed capsule blocked across track " + str(offset))
	state.set_flag(0, flag)
	await physics_frame
	for offset in [-4.1, 0.0, 4.1]:
		var start: Vector3 = center - normal * 6.0 + tangent * offset
		expect(not hero.test_move(Transform3D(Basis.IDENTITY, start), normal * 12.0), id + " opened capsule crosses track " + str(offset))
	state.set_flag(0, flag, false)
	await physics_frame

func _sweep_route(world: Node, hero: TrialHero, start: Vector2i, goal: Vector2i, label: String) -> void:
	var route: Array[Vector2i] = Maze.path(world.grid, start, goal, world._blocked_cells())
	var clear: bool = not route.is_empty()
	for i in range(maxi(0, route.size() - 1)):
		var origin: Vector3 = world.cell_to_world(route[i]) + Vector3(0, 0.08, 0)
		var motion: Vector3 = world.cell_to_world(route[i + 1]) - world.cell_to_world(route[i])
		if hero.test_move(Transform3D(Basis.IDENTITY, origin), motion):
			clear = false
			break
		swept_legs += 1
	expect(clear, label + " capsule passes every authored corridor leg")

func _interact_from_ray(world: Node, hero: TrialHero, id: String) -> bool:
	var target: Node3D = world.get_feature(id)
	hero.global_position = world.cell_to_world(target.data["cell"]) + Vector3(0, 0.08, 2.6)
	hero.camera.look_at(target.global_position, Vector3.UP)
	var query = PhysicsRayQueryParameters3D.create(hero.camera.global_position, hero.camera.global_position - hero.camera.global_transform.basis.z * 3.4, 9)
	query.exclude = [hero.get_rid()]
	var hit: Dictionary = world.get_world_3d().direct_space_state.intersect_ray(query)
	var reached: bool = not hit.is_empty() and hit.get("collider") == target
	expect(reached, id + " reachable through actual3.4m interaction ray")
	if reached:
		hit["collider"].interact(hero)
	return reached

func _run() -> void:
	var state = TrialState.new()
	root.add_child(state)
	var world: Node = WorldScript.new()
	root.add_child(world)
	world.configure(state)
	var hero = TrialHero.new()
	root.add_child(hero)
	var original_specs: Array[Dictionary] = []
	for index in range(1, 5):
		original_specs.append(world.get_floor_spec(index))
	world.load_floor(0)
	await process_frame
	await physics_frame
	var spec: Dictionary = world.get_floor_spec(0)
	var metrics: Dictionary = world.get_floor_metrics(0)
	expect(metrics["cell_size"] == 9.0 and metrics["wall_height"] == 5.4, "Earth metric9m/5.4m")
	expect(world.cell_size == 9.0 and world.get_map_data()["cell_size"] == 9.0, "active and map metrics agree")
	expect(world.get_spawn_position().is_equal_approx(Vector3(-126, 0.08, -126)), "saved entry cell remaps to wide Earth")
	for index in range(1, 5):
		expect(world.get_floor_spec(index) == original_specs[index - 1], "indexed floor" + str(index) + " spec unaffected while Earth active")
	expect(world.get_child_count() == 1, "one active floor")
	var skyline: MultiMeshInstance3D = world.current_floor_node.get_node("EarthDistantSkyline")
	expect(skyline.multimesh.instance_count == 24, "bounded single-batch skyline")
	if DisplayServer.get_name() != "headless":
		for i in range(skyline.multimesh.instance_count):
			var transform: Transform3D = skyline.multimesh.get_instance_transform(i)
			expect(maxf(absf(transform.origin.x), absf(transform.origin.z)) > 150.0, "rendered skyline stays outside maze footprint")
	expect(world._materials["wall0"].uv1_scale == Vector3(3, 1.6875, 1), "Earth wall stone repeats preserve scale")
	expect(world._materials["floor0"].uv1_scale == Vector3(3, 3, 1), "Earth floor repeats preserve scale")
	var corridor: Vector3 = world.cell_to_world(Vector2i(1, 9)) + Vector3(0, 1, 0)
	var left: Dictionary = _ray(world, corridor, corridor - Vector3(9, 0, 0))
	var right: Dictionary = _ray(world, corridor, corridor + Vector3(9, 0, 0))
	expect(not left.is_empty() and not right.is_empty(), "independent corridor rays hit both walls")
	if not left.is_empty() and not right.is_empty():
		expect(is_equal_approx(left["position"].distance_to(right["position"]), 9.0), "actual physical clear width9m")
	var wall_center: Vector3 = world.cell_to_world(Vector2i(0, 9))
	var top: Dictionary = _ray(world, wall_center + Vector3(0, 10, 0), wall_center + Vector3(0, 0.1, 0))
	expect(not top.is_empty() and is_equal_approx(top["position"].y, 5.4), "actual physical wall top5.4m")
	for id in ["key_gate", "shortcut_gate"]:
		var body: Node = world.get_feature(id)
		expect(body.collider.shape.size == Vector3(8.9, 5.4, 0.5), id + " actual full-width blocker")
	await _test_gate(world, state, hero, "key_gate", "gate_open")
	await _test_gate(world, state, hero, "shortcut_gate", "shortcut_open")
	var entry: Vector2i = Maze.point(spec["markers"]["entry"])
	var chest_cell: Vector2i = world.get_feature("weapon_chest").data["cell"]
	var key_cell: Vector2i = Maze.point(spec["markers"]["key"])
	var boss_cell: Vector2i = Maze.point(spec["markers"]["boss"])
	_sweep_route(world, hero, entry, chest_cell, "entry to weapon chest")
	_sweep_route(world, hero, chest_cell, key_cell, "weapon chest to local key")
	_interact_from_ray(world, hero, "weapon_chest")
	expect(state.has_item("sword") and state.has_item("buckler"), "ray interaction rewards weapon chest")
	_interact_from_ray(world, hero, "floor_key")
	expect(state.has_flag(0, "key_collected"), "ray interaction acquires local key")
	_interact_from_ray(world, hero, "key_gate")
	await physics_frame
	expect(state.has_flag(0, "gate_open"), "ray interaction opens key gate")
	_sweep_route(world, hero, key_cell, boss_cell, "key to boss through opened gate")
	_interact_from_ray(world, hero, "return_lever")
	await physics_frame
	expect(state.has_flag(0, "shortcut_open"), "ray interaction opens return shortcut")
	_sweep_route(world, hero, boss_cell, entry, "boss return through shortcut")
	var refuge: Vector3 = world.cell_to_world(entry)
	expect(world.is_safe_refuge(refuge + Vector3(7, 0, 0)), "refuge includes exact7m boundary")
	expect(not world.is_safe_refuge(refuge + Vector3(7.01, 0, 0)), "refuge bounded past7m")
	expect(not world.is_safe_refuge(refuge + Vector3(0, 2.51, 0)), "refuge bounded vertically")
	expect(not world.is_safe_refuge(world.get_feature("merchant").global_position), "merchant remains combat space")
	var rests: Array[Dictionary] = []
	world.refuge_requested.connect(func(): rests.append({"saved": state.save_calls, "restocked": state.restock_calls, "healed": hero.healed}))
	_interact_from_ray(world, hero, "checkpoint")
	expect(rests.size() == 1 and rests[0]["saved"] > 0 and rests[0]["restocked"] > 0 and rests[0]["healed"], "refuge event follows completed heal/refill/save")
	state.set_checkpoint(0, Vector2i(5, 7))
	expect(world.get_spawn_position().is_equal_approx(world.cell_to_world_for_floor(Vector2i(5, 7), 0) + Vector3(0, 0.08, 0)), "arbitrary saved Earth cell preserves identity")
	var groups: Dictionary = {}
	var levels: Dictionary = {}
	var hidden: int = 0
	for spawn in spec["enemy_spawns"]:
		expect(world.world_to_cell(spawn["position"]) == spawn["cell"], "squad lane stays within authored cell")
		if bool(spawn.get("hidden", false)):
			hidden += 1
		else:
			groups[spawn["group_id"]] = int(groups.get(spawn["group_id"], 0)) + 1
			levels[int(spawn["combat_level"])] = true
	expect(groups.size() == 8 and hidden == 1 and spec["enemy_spawns"].size() == 25, "eight squads plus separate hidden guardian")
	for count in groups.values():
		expect(count == 3, "each squad contains exactly3regular enemies")
	expect(levels.size() == 3, "squads include combat levels1to3")
	for index in range(1, 5):
		world.load_floor(index)
		await process_frame
		await physics_frame
		expect(world.cell_size == 3.0 and world.get_floor_metrics(index)["wall_height"] == 3.2, "floor" + str(index) + " original metrics retained")
		expect(world.get_floor_spec(index) == original_specs[index - 1], "floor" + str(index) + " indexed descriptors unchanged after switching")
		expect(world.get_feature("key_gate").collider.shape.size == Vector3(2.9, 2.7, 0.36), "floor" + str(index) + " original gate retained")
		expect(not world.is_safe_refuge(world.get_spawn_position()), "later floors retain original combat rules")
		expect(world.current_floor_node.get_node_or_null("EarthDistantSkyline") == null, "Earth skyline remains floor-local")
		expect(world._materials["wall" + str(index)].uv1_scale == Vector3.ONE, "later-floor texture metrics retained")
	var hash = HashingContext.new()
	hash.start(HashingContext.HASH_SHA256)
	hash.update(FileAccess.get_file_as_bytes("res:/" + "/ELEMENTAL_LABYRINTHS_V1.json"))
	expect(hash.finish().hex_encode() == "5d0b5a2e480dcddd286c6c18d44589c8c4cdddb9629b8e6e537ee8e26eca8095", "all authored maze and marker bytes unchanged")
	print("EARTH_WIDTH_TESTS checks=", checks, " failures=", failures, " physical_route_legs=", swept_legs)
	quit(1 if failures > 0 else 0)
