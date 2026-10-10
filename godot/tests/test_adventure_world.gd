extends SceneTree

var Maze = load("res:/" + "/scripts/adventure_maze.gd")
var World = load("res:/" + "/scripts/adventure_world.gd")
var checks: int = 0
var failures: int = 0

class MockState extends Node:
	signal inventory_changed
	signal progression_changed
	var current_floor: int = 0
	var checkpoint_floor: int = -1
	var checkpoint_cell: Vector2i = Vector2i.ZERO
	var equipped_weapon: String = "driftwood"
	var souls: int = 0
	var items: Dictionary = {}
	var levels: Dictionary = {}
	var flags: Dictionary = {}
	func tool_level(id: String) -> int:
		return int(levels.get(id, 1))
	func has_item(id: String) -> bool:
		return items.has(id)
	func acquire_item(id: String) -> void:
		items[id] = true
		inventory_changed.emit()
	func has_flag(floor_index: int, id: String) -> bool:
		return flags.get(str(floor_index), {}).get(id, false)
	func set_flag(floor_index: int, id: String, value: bool = true) -> void:
		if not flags.has(str(floor_index)):
			flags[str(floor_index)] = {}
		flags[str(floor_index)][id] = value
		progression_changed.emit()
	func can_travel_to(_floor: int) -> bool:
		return true
	func set_checkpoint(floor_index: int, cell: Vector2i) -> void:
		checkpoint_floor = floor_index
		checkpoint_cell = cell
	func restock_at_checkpoint() -> void:
		pass
	func save_game() -> bool:
		return true
	func add_ammo(_weapon: String, _amount: int) -> void:
		pass
	func upgrade_tool(_id: String) -> bool:
		return false

class MockPlayer extends CharacterBody3D:
	var camera: Camera3D
	var diving: bool = false
	var hp: float = 100.0
	func _init() -> void:
		camera = Camera3D.new()
		camera.position.y = 1.52
		add_child(camera)
	func set_diving(value: bool) -> void:
		diving = value
	func heal_to_full() -> void:
		hp = 100.0
	func take_damage(amount: float, _source: Vector3 = Vector3.ZERO) -> void:
		hp -= amount

func _initialize() -> void:
	call_deferred("_run")

func expect(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		push_error("WORLD TEST FAILED: " + label)

func _coverage(grid_value: Array, walls: bool, omitted: Dictionary = {}) -> bool:
	var covered: Dictionary = {}
	for rect in Maze.merged_runs(grid_value, walls, omitted):
		var first: Vector2i = rect["cell"]
		var size_value: Vector2i = rect["size"]
		for z in range(first.y, first.y + size_value.y):
			for x in range(first.x, first.x + size_value.x):
				var cell: Vector2i = Vector2i(x, z)
				var key: String = Maze.cell_key(cell)
				if covered.has(key):
					return false
				covered[key] = true
	for z in range(grid_value.size()):
		for x in range(str(grid_value[z]).length()):
			var cell: Vector2i = Vector2i(x, z)
			var expected: bool = (str(grid_value[z]).substr(x, 1) == "#") == walls and not omitted.has(Maze.cell_key(cell))
			if covered.has(Maze.cell_key(cell)) != expected:
				return false
	return true

func _run() -> void:
	var state: MockState = MockState.new()
	root.add_child(state)
	var world: Node = World.new()
	root.add_child(world)
	world.configure(state)
	var player: MockPlayer = MockPlayer.new()
	root.add_child(player)
	for index in range(5):
		world.load_floor(index)
		await process_frame
		await physics_frame
		var spec: Dictionary = world.get_floor_spec(index)
		var source_grid: Array = spec["grid"]
		var entry: Vector2i = Maze.point(spec["markers"]["entry"])
		var gate: Vector2i = Maze.point(spec["markers"]["gate"])
		var shortcut: Vector2i = Maze.point(spec["markers"]["shortcut"])
		var key_cell: Vector2i = Maze.point(spec["markers"]["key"])
		var boss_cell: Vector2i = Maze.point(spec["markers"]["boss"])
		var blocked: Dictionary = {Maze.cell_key(gate): true, Maze.cell_key(shortcut): true}
		var pre: Dictionary = Maze.reachable(source_grid, entry, blocked)
		var navigation: Dictionary = world.get_navigation_data()
		expect(navigation["size"] == 31 and navigation["grid"] == source_grid, "navigation grid snapshot matches active floor")
		expect(navigation["blocked"].has(gate) and navigation["blocked"].has(shortcut), "navigation snapshot uses blocked Vector2i cells")
		var nav_revision: int = int(navigation["revision"])
		world.refresh_features()
		state.acquire_item("navigation_probe_" + str(index))
		state.set_flag(index, "navigation_probe")
		expect(world.get_navigation_data()["revision"] == nav_revision, "unrelated flags and inventory preserve topology revision")
		navigation["blocked"].clear()
		navigation["grid"].clear()
		expect(not world.is_walkable(gate) and world.get_navigation_data()["size"] == 31, "navigation snapshot mutation cannot alter world")
		expect(source_grid.size() == 31 and str(source_grid[0]).length() == 31, "31-square source floor " + str(index))
		expect(pre.has(Maze.cell_key(key_cell)), "key before gate " + str(index))
		expect(not pre.has(Maze.cell_key(boss_cell)), "boss behind gate " + str(index))
		expect(_coverage(source_grid, true), "wall colliders cover exactly solid tiles " + str(index))
		expect(_coverage(source_grid, false), "floor colliders cover exactly open tiles " + str(index))
		expect(world.get_child_count() == 1, "one runtime floor " + str(index))
		expect(spec["enemy_spawns"].size() <= 8, "bounded enemy descriptors " + str(index))
		expect(spec["enemy_spawns"] == world.get_floor_spec(index)["enemy_spawns"], "deterministic spawn descriptors " + str(index))
		for spawn in spec["enemy_spawns"]:
			expect(Maze.is_open(source_grid, spawn["cell"]), "enemy on corridor floor")
		expect(world.get_feature("key_gate").collision_layer == 9, "closed gate blocks hero and offers interaction")
		world.get_feature("key_gate").interact(player)
		expect(not state.has_flag(index, "gate_open"), "unowned key cannot open gate")
		if index != 1:
			world.get_feature("floor_key").interact(player)
			world.get_feature("key_gate").interact(player)
			expect(state.has_flag(index, "gate_open"), "key opens permanent gate")
		expect(world.world_to_cell(world.cell_to_world(key_cell)) == key_cell, "coordinate round trip")
		var allowed_neighbors: Array[Vector2i] = Maze.neighbors(source_grid, entry, world._blocked_cells())
		if not allowed_neighbors.is_empty():
			expect(world.next_path_step(entry, allowed_neighbors[0]) == allowed_neighbors[0], "path step follows adjacent open corridor")
	world.load_floor(0)
	await process_frame
	world.get_feature("weapon_chest").interact(player)
	expect(state.has_item("sword") and state.has_item("buckler"), "Earth weapon chest rewards")
	world.get_feature("sun_roots").hit_weapon("bow")
	expect(not state.has_item("sun_seal"), "wrong weapon cannot open staff secret")
	state.acquire_item("staff")
	world.get_feature("sun_roots").hit_weapon("staff")
	expect(not state.has_item("sun_seal"), "staff secret stays sealed before Aether Sight")
	state.acquire_item("aether_sight")
	world.get_feature("sun_roots").hit_weapon("staff")
	expect(state.has_item("sun_seal") and state.has_flag(0, "sun_secret"), "staff grants persistent Sun Seal")
	expect(state.has_flag(0, "hidden_guardian_awake"), "staff secret wakes hidden guardian")
	world.load_floor(1)
	await process_frame
	player.position = world.get_spawn_position()
	var dry_position: Vector3 = player.position
	world.get_feature("dive_station").interact(player)
	expect(player.position == dry_position and not player.diving, "charm-less dive is blocked")
	state.acquire_item("tide_charm")
	world.get_feature("dive_station").interact(player)
	expect(player.position.y < -2.0 and player.diving, "dive enters actual recessed pocket")
	await physics_frame
	var tide_key: Node3D = world.get_feature("floor_key")
	var depth_ray: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(player.camera.global_position, tide_key.global_position, 9)
	var depth_hit: Dictionary = world.get_world_3d().direct_space_state.intersect_ray(depth_ray)
	expect(not depth_hit.is_empty() and depth_hit["collider"] == tide_key, "dive spawn has direct interaction line to small Tide Key")
	expect(player.camera.global_position.y > -2.0 and player.camera.global_position.y < 0.0, "underwater camera remains inside pocket")
	expect(player.camera.environment != null, "underwater camera environment")
	world.get_feature("floor_key").interact(player)
	expect(state.has_flag(1, "key_collected"), "submerged key acquired underwater")
	world.get_feature("return_bubble").interact(player)
	expect(player.position.y >= 0.0 and not player.diving, "bubble returns to dry passage")
	expect(player.camera.environment == null, "return restores camera environment")
	world.get_feature("key_gate").interact(player)
	expect(state.has_flag(1, "gate_open"), "dive key opens Water gate")
	world.load_floor(2)
	await process_frame
	await physics_frame
	var fire_spec: Dictionary = world.get_floor_spec(2)
	var fire_gate: Vector2i = Maze.point(fire_spec["markers"]["gate"])
	expect(not world.is_walkable(fire_gate), "raised bridge blocks main boss route")
	expect(world.bridge_deck.collision_layer == 0 and not world.bridge_visual.visible, "raised bridge has no deck physics")
	world.get_feature("floor_key").interact(player)
	world.get_feature("key_gate").interact(player)
	world.get_feature("bridge_lever").hit_weapon("staff")
	expect(not state.has_flag(2, "bridge_lowered"), "wrong tool cannot lower bridge")
	state.acquire_item("bow")
	await physics_frame
	var raised_lever: Node = world.get_feature("bridge_lever")
	var raised_far_cell: Vector2i = Maze.point(fire_spec["markers"]["lever"])
	var raised_approach: Vector2i = fire_gate + (fire_gate - raised_far_cell)
	var raised_query: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(world.cell_to_world(raised_approach) + Vector3(0, 1.5, 0), raised_lever.global_position, 9)
	var raised_hit: Dictionary = world.get_world_3d().direct_space_state.intersect_ray(raised_query)
	expect(not raised_hit.is_empty() and raised_hit["collider"] == raised_lever, "raised bridge permits the required bow shot")
	var raised_revision: int = int(world.get_navigation_data()["revision"])
	world.get_feature("bridge_lever").hit_weapon("bow")
	expect(world.get_navigation_data()["revision"] > raised_revision, "bridge opening changes topology revision")
	expect(world.is_walkable(fire_gate), "bow lever connects Fire boss route")
	expect(world.bridge_deck.collision_layer == 1 and world.bridge_visual.visible, "lowered deck is physical")
	await physics_frame
	var gate_position: Vector3 = world.cell_to_world(fire_gate)
	var deck_query: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(gate_position + Vector3(0, 1, 0), gate_position + Vector3(0, -1, 0), 1)
	var deck_hit: Dictionary = world.get_world_3d().direct_space_state.intersect_ray(deck_query)
	expect(not deck_hit.is_empty() and deck_hit["collider"] == world.bridge_deck, "bridge floor ray hits actual lowered deck")
	var lever: Node = world.get_feature("bridge_lever")
	var far_cell: Vector2i = Maze.point(fire_spec["markers"]["lever"])
	var approach: Vector2i = fire_gate + (fire_gate - far_cell)
	var bow_query: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(world.cell_to_world(approach) + Vector3(0, 1.5, 0), lever.global_position, 9)
	var lever_hit: Dictionary = world.get_world_3d().direct_space_state.intersect_ray(bow_query)
	expect(not lever_hit.is_empty() and lever_hit["collider"] == lever, "chain ring has clear bow line from near shore")
	world.get_feature("moon_grate").hit_weapon("sword")
	expect(not state.has_item("moon_seal"), "wrong tool cannot recover Moon Seal")
	state.acquire_item("spear")
	world.get_feature("moon_grate").hit_weapon("spear")
	expect(state.has_item("moon_seal"), "spear secret grants Moon Seal")
	player.add_to_group("adventure_player")
	var hazard: Vector2i = Vector2i.ZERO
	for raw in fire_spec["markers"]["hazards"]:
		var candidate: Vector2i = Maze.point(raw)
		if world._hazard_cells.has(Maze.cell_key(candidate)):
			hazard = candidate
			break
	player.position = world.cell_to_world(hazard)
	world._burn_cooldown = 0.0
	world._physics_process(0.2)
	expect(is_equal_approx(player.hp, 88.0), "unowned Sigil shallow lava damage remains12")
	state.acquire_item("ember_sigil")
	for tier in range(1, 4):
		state.levels["ember_sigil"] = tier
		player.position = world.cell_to_world(hazard)
		player.hp = 100.0
		world._burn_cooldown = 0.0
		world._physics_process(0.2)
		expect(is_equal_approx(player.hp, 100.0 - (4.0 - float(tier))), "Sigil tier%d shallow lava exact effect" % tier)
		player.position = world.cell_to_world(fire_gate) + Vector3(0, -0.5, 0)
		player.hp = 100.0
		world._burn_cooldown = 0.0
		world._physics_process(0.2)
		expect(is_equal_approx(player.hp, 100.0 - (35.0 - 7.0 * float(tier - 1))), "Sigil tier%d chasm exact effect" % tier)
	player.remove_from_group("adventure_player")
	world.load_floor(3)
	await process_frame
	world.get_feature("wind_barrier").interact(player)
	expect(not state.has_flag(3, "wind_open"), "wind gate rejects missing mantle")
	state.acquire_item("gale_mantle")
	world.get_feature("wind_barrier").interact(player)
	expect(state.has_flag(3, "wind_open"), "mantle opens persistent wind gate")
	state.items.erase("aether_sight")
	world.load_floor(4)
	await process_frame
	world.get_feature("arcane_barrier").interact(player)
	expect(not state.has_flag(4, "arcane_open"), "arcane gate rejects missing sight")
	state.acquire_item("aether_sight")
	world.get_feature("arcane_barrier").interact(player)
	expect(state.has_flag(4, "arcane_open"), "sight reveals true route")
	print("ADVENTURE_WORLD_TESTS checks=", checks, " failures=", failures)
	quit(1 if failures > 0 else 0)
