class_name AdventureWorld
extends Node3D

signal floor_built(index: int)
signal travel_requested(index: int)
signal message(text: String)
signal merchant_requested

var Maze = load("res:/" + "/scripts/adventure_maze.gd")
var Feature = load("res:/" + "/scripts/adventure_feature.gd")
var state: Node
var current_floor: int = 0
var current_floor_node: Node3D
var cell_size: float = 3.0
var grid: Array[String] = []
var features: Dictionary = {}
var floor_specs: Array[Dictionary] = []
var active_spec: Dictionary = {}
var bridge_deck: StaticBody3D
var bridge_visual: MeshInstance3D
var _hazard_cells: Dictionary = {}
var _hazard_clock: float = 0.0
var _burn_cooldown: float = 0.0
var _underwater_environment: Environment
var _prior_camera_environment: Environment
var _materials: Dictionary = {}
var _stats: Dictionary = {}
var _blocked_cache: Dictionary = {}
var _navigation_blocked: Dictionary = {}
var _navigation_revision: int = 0

func configure(adventure_state: Node) -> void:
	state = adventure_state
	_ensure_specs()
	if state != null:
		if not state.progression_changed.is_connected(refresh_features):
			state.progression_changed.connect(refresh_features)
		if not state.inventory_changed.is_connected(refresh_features):
			state.inventory_changed.connect(refresh_features)

func _ensure_specs() -> void:
	if not floor_specs.is_empty():
		return
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res:/" + "/ELEMENTAL_LABYRINTHS_V1.json"))
	if not parsed is Dictionary or not parsed.has("floors"):
		push_error("Elemental maze specification is missing or invalid.")
		return
	for source in parsed["floors"]:
		var spec: Dictionary = source.duplicate(true)
		spec["color"] = Color(str(source.get("color", "#806f4b")))
		spec["boss_spawn"] = cell_to_world(Maze.point(source["markers"]["boss"])) + Vector3(0, 0.05, 0)
		spec["entry_spawn"] = cell_to_world(Maze.point(source["markers"]["entry"])) + Vector3(0, 0.08, 0)
		floor_specs.append(spec)

func get_floor_spec(index: int) -> Dictionary:
	_ensure_specs()
	if index < 0 or index >= floor_specs.size():
		return {}
	var spec: Dictionary = floor_specs[index].duplicate(true)
	spec["features"] = _feature_definitions(spec, index)
	spec["enemy_spawns"] = _enemy_spawns(spec, index)
	spec["hidden_spawn"] = spec["enemy_spawns"][-1]["position"] if not spec["enemy_spawns"].is_empty() else spec["boss_spawn"]
	return spec

func load_floor(index: int) -> void:
	if floor_specs.is_empty():
		_ensure_specs()
	if index < 0 or index >= floor_specs.size():
		return
	if is_instance_valid(current_floor_node):
		remove_child(current_floor_node)
		current_floor_node.queue_free()
	features.clear()
	bridge_deck = null
	bridge_visual = null
	current_floor = index
	active_spec = get_floor_spec(index)
	grid.clear()
	for row in active_spec["grid"]:
		grid.append(str(row))
	_rebuild_navigation_cache(true)
	current_floor_node = Node3D.new()
	current_floor_node.name = "ElementalFloor" + str(index)
	add_child(current_floor_node)
	_hazard_cells.clear()
	_hazard_clock = 0.0
	_burn_cooldown = 0.0
	for raw in active_spec["markers"].get("hazards", []):
		var cell: Vector2i = Maze.point(raw)
		var entry: Vector2i = Maze.point(active_spec["markers"]["entry"])
		if absi(cell.x - entry.x) + absi(cell.y - entry.y) > 4:
			_hazard_cells[Maze.cell_key(cell)] = true
	_build_geometry()
	_build_landmarks()
	for definition in active_spec["features"]:
		var feature: Node = Feature.new()
		feature.configure(self, definition)
		current_floor_node.add_child(feature)
		features[str(definition["id"])] = feature
	refresh_features()
	floor_built.emit(index)

func cell_to_world(cell: Vector2i) -> Vector3:
	return Vector3(float(cell.x - 15) * cell_size, 0.0, float(cell.y - 15) * cell_size)

func world_to_cell(position_value: Vector3) -> Vector2i:
	return Vector2i(roundi(position_value.x / cell_size) + 15, roundi(position_value.z / cell_size) + 15)

func get_spawn_position() -> Vector3:
	if state != null and int(state.checkpoint_floor) == current_floor:
		var checkpoint: Vector2i = state.checkpoint_cell
		if is_walkable(checkpoint):
			return cell_to_world(checkpoint) + Vector3(0, 0.08, 0)
	return active_spec.get("entry_spawn", Vector3.ZERO)

func get_spawn_yaw() -> float:
	var entry: Vector2i = world_to_cell(get_spawn_position())
	var available: Array[Vector2i] = Maze.neighbors(grid, entry, _blocked_cells())
	if available.is_empty():
		return PI
	var direction: Vector3 = cell_to_world(available[0]) - cell_to_world(entry)
	return atan2(-direction.x, -direction.z)

func _compute_blocked_cells() -> Dictionary:
	var blocked: Dictionary = {}
	if active_spec.is_empty():
		return blocked
	var markers: Dictionary = active_spec["markers"]
	if state == null or not state.has_flag(current_floor, "gate_open"):
		blocked[Maze.cell_key(Maze.point(markers["gate"]))] = true
	if state == null or not state.has_flag(current_floor, "shortcut_open"):
		blocked[Maze.cell_key(Maze.point(markers["shortcut"]))] = true
	if current_floor == 1:
		blocked[Maze.cell_key(Maze.point(markers["key"]))] = true
	if current_floor == 2 and (state == null or not state.has_flag(current_floor, "bridge_lowered")):
		blocked[Maze.cell_key(Maze.point(markers["gate"]))] = true
	if current_floor == 3 and (state == null or not state.has_flag(current_floor, "wind_open")):
		blocked[Maze.cell_key(Maze.point(markers["gate"]))] = true
	if current_floor == 4 and (state == null or not state.has_flag(current_floor, "arcane_open")):
		blocked[Maze.cell_key(Maze.point(markers["gate"]))] = true
	return blocked

func _rebuild_navigation_cache(force: bool = false) -> void:
	var updated: Dictionary = _compute_blocked_cells()
	if not force and updated == _blocked_cache:
		return
	_blocked_cache = updated
	_navigation_blocked.clear()
	for key in _blocked_cache:
		var parts: PackedStringArray = str(key).split(":")
		_navigation_blocked[Vector2i(int(parts[0]), int(parts[1]))] = true
	_navigation_revision += 1

func _blocked_cells() -> Dictionary:
	return _blocked_cache

func get_navigation_data() -> Dictionary:
	return {"grid": grid.duplicate(), "blocked": _navigation_blocked.duplicate(), "size": grid.size(), "revision": _navigation_revision, "floor": current_floor}

func is_walkable(cell: Vector2i) -> bool:
	return Maze.is_open(grid, cell, _blocked_cells())

func next_path_step(start: Vector2i, goal: Vector2i) -> Vector2i:
	var route: Array[Vector2i] = Maze.path(grid, start, goal, _blocked_cells())
	return route[1] if route.size() > 1 else start

func get_map_data() -> Dictionary:
	var markers: Array[Dictionary] = []
	for definition in active_spec.get("features", []):
		var done: bool = state != null and state.has_flag(current_floor, str(definition.get("flag", definition["id"])))
		markers.append({"id": definition["id"], "kind": definition["kind"], "cell": definition["cell"], "position": definition["position"], "name": definition.get("label", ""), "done": done})
	if active_spec.has("markers"):
		markers.append({"id": "guardian", "kind": "boss", "cell": Maze.point(active_spec["markers"]["boss"]), "position": active_spec["boss_spawn"], "name": active_spec["boss"], "done": state != null and state.has_flag(current_floor, "boss_defeated")})
	return {"grid": grid.duplicate(), "markers": markers, "size": grid.size(), "floor": current_floor, "cell_size": cell_size}

func get_feature(id: String) -> Node:
	return features.get(id)

func get_debug_stats() -> Dictionary:
	var result: Dictionary = _stats.duplicate()
	result["active_floor"] = current_floor
	result["floor_children"] = get_child_count()
	result["features"] = features.size()
	return result

func refresh_features() -> void:
	_rebuild_navigation_cache()
	for feature in features.values():
		if is_instance_valid(feature):
			feature.refresh()
	if is_instance_valid(bridge_deck):
		var lowered: bool = state != null and state.has_flag(current_floor, "bridge_lowered")
		bridge_deck.collision_layer = 1 if lowered else 0
		bridge_visual.visible = lowered

func notify(text: String) -> void:
	message.emit(text)

func _definition(id: String, kind: String, cell: Vector2i, label_text: String, color_value: Color, extra: Dictionary = {}) -> Dictionary:
	var definition: Dictionary = {"id": id, "kind": kind, "cell": cell, "position": cell_to_world(cell) + Vector3(0, 0.55, 0), "label": label_text, "color": color_value, "flag": id}
	definition.merge(extra, true)
	return definition

func _feature_definitions(spec: Dictionary, index: int) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var source_grid: Array = spec["grid"]
	var markers: Dictionary = spec["markers"]
	var entry: Vector2i = Maze.point(markers["entry"])
	var gate: Vector2i = Maze.point(markers["gate"])
	var shortcut: Vector2i = Maze.point(markers["shortcut"])
	var key_cell: Vector2i = Maze.point(markers["key"])
	var blocked: Dictionary = {Maze.cell_key(gate): true, Maze.cell_key(shortcut): true}
	var reserved: Dictionary = {}
	for value in markers.values():
		if value is Array and value.size() == 2 and value[0] is float:
			reserved[Maze.cell_key(Maze.point(value))] = true
		elif value is Array and value.size() == 2 and value[0] is int:
			reserved[Maze.cell_key(Maze.point(value))] = true
	var secret_cell: Vector2i = Maze.choose_branch(source_grid, entry, blocked, reserved)
	reserved[Maze.cell_key(secret_cell)] = true
	var merchant_cell: Vector2i = Maze.choose_branch(source_grid, entry, blocked, reserved, 1)
	reserved[Maze.cell_key(merchant_cell)] = true
	var loot_cell: Vector2i = Maze.choose_branch(source_grid, entry, blocked, reserved, 2)
	var door_rotation: float = PI * 0.5 if gate.x % 2 == 0 else 0.0
	result.append(_definition("checkpoint", "checkpoint", entry, "Shore fire" if index == 0 else "Rest shrine", Color(0.2, 0.8, 0.7), {"position": cell_to_world(entry) + Vector3(0.8, 0.3, -0.5)}))
	if index < 4:
		result.append(_definition("lift_up", "lift_up", entry, "Lift to floor " + str(index + 2), Color(0.65, 0.52, 0.95), {"target_floor": index + 1, "position": cell_to_world(entry) + Vector3(-0.8, 0.55, 0.65)}))
	if index > 0:
		result.append(_definition("lift_down", "lift_down", entry, "Return to floor " + str(index), Color(0.4, 0.65, 0.9), {"target_floor": index - 1, "position": cell_to_world(entry) + Vector3(0.8, 0.55, 0.65)}))
	var key_kind: String = "water_key" if index == 1 else "key"
	var key_position: Vector3 = cell_to_world(key_cell) + (Vector3(-0.25, -2.53, -0.55) if index == 1 else Vector3(0, 0.55, 0))
	result.append(_definition("floor_key", key_kind, key_cell, str(spec["key"]), Color(1.0, 0.84, 0.15), {"flag": "key_collected", "position": key_position}))
	result.append(_definition("key_gate", "gate", gate, "Key gate", Color(0.6, 0.4, 0.15), {"flag": "gate_open", "position": cell_to_world(gate) + Vector3(0, 1.35, 0), "rotation_y": door_rotation}))
	result.append(_definition("shortcut_gate", "shortcut", shortcut, "Return gate", Color(0.32, 0.6, 0.46), {"flag": "shortcut_open", "position": cell_to_world(shortcut) + Vector3(0, 1.35, 0), "rotation_y": PI * 0.5 if shortcut.x % 2 == 0 else 0.0}))
	result.append(_definition("return_lever", "lever", Maze.point(markers["lever"]), "Return lever", Color(0.5, 0.9, 0.55), {"flag": "shortcut_open"}))
	result.append(_definition("merchant", "merchant", merchant_cell, "Captive tower smith", Color(0.85, 0.6, 0.32), {"flag": "merchant_free"}))
	result.append(_definition("supply_cache", "loot", loot_cell, "Hidden supplies", Color(0.9, 0.7, 0.3), {"flag": "supply_cache"}))
	if index == 0:
		var route: Array[Vector2i] = Maze.path(source_grid, entry, key_cell, blocked)
		var chest_cell: Vector2i = route[mini(5, route.size() - 1)] if not route.is_empty() else entry
		result.append(_definition("weapon_chest", "chest", chest_cell, "Sword and buckler", Color(0.7, 0.45, 0.18), {"flag": "weapon_chest", "items": ["sword", "buckler"]}))
		result.append(_definition("sun_roots", "secret_staff", secret_cell, "Sun-sealed roots", Color(0.5, 0.6, 0.22), {"flag": "sun_secret"}))
	elif index == 1:
		var accessible: Array[Vector2i] = Maze.neighbors(source_grid, key_cell, blocked)
		var station: Vector2i = accessible[0] if not accessible.is_empty() else entry
		result.append(_definition("dive_station", "dive_station", station, "Dive station", Color(0.2, 0.65, 0.95)))
		result.append(_definition("dive_hatch", "dive_hatch", key_cell, "", Color(0.2, 0.6, 0.9), {"position": cell_to_world(key_cell) + Vector3(0, 1.35, 0), "rotation_y": PI * 0.5 if station.x != key_cell.x else 0.0}))
		result.append(_definition("return_bubble", "return_bubble", key_cell, "Return bubbles", Color(0.4, 0.9, 1.0), {"position": cell_to_world(key_cell) + Vector3(0.6, -2.28, -0.4)}))
	elif index == 2:
		result.append(_definition("lava_bridge", "bridge", gate, "Raised lava bridge", Color(0.42, 0.25, 0.1), {"flag": "bridge_lowered", "position": cell_to_world(gate) + Vector3(0, 0.9, 0), "rotation_y": door_rotation}))
		result.append(_definition("bridge_lever", "bridge_lever", Maze.point(markers["lever"]), "Bow chain ring", Color(1.0, 0.55, 0.15), {"flag": "bridge_lowered", "position": cell_to_world(Maze.point(markers["lever"])) + Vector3(0, 3.55, 0)}))
		result.append(_definition("moon_grate", "secret_spear", secret_cell, "Moon-sealed grate", Color(0.6, 0.65, 0.8), {"flag": "moon_secret"}))
	elif index == 3:
		result.append(_definition("wind_barrier", "wind_gate", gate, "Storm barrier", Color(0.6, 0.8, 0.95), {"flag": "wind_open", "position": cell_to_world(gate) + Vector3(0, 1.35, 0.6), "rotation_y": door_rotation}))
	elif index == 4:
		result.append(_definition("arcane_barrier", "arcane_gate", gate, "True passage", Color(0.7, 0.4, 0.95), {"flag": "arcane_open", "position": cell_to_world(gate) + Vector3(0, 1.35, 0.6), "rotation_y": door_rotation}))
	if index < 4:
		result.append(_definition("guardian_exit", "exit", Maze.point(markers["exit"]), "Guardian lift", Color(0.8, 0.7, 1.0), {"target_floor": index + 1}))
	return result

func _enemy_spawns(spec: Dictionary, index: int) -> Array[Dictionary]:
	var rosters: Array = [["thornbound_revenant", "cave_spider", "moss_troll", "barrow_knight"], ["mire_hag", "frost_wraith"], ["ember_imp", "ash_zealot"], ["storm_gargoyle", "tempest_harpy"], ["rune_sentinel", "mirror_duelist", "barrow_knight"]]
	var hidden_ids: Array[String] = ["barrow_knight", "frost_wraith", "barrow_knight", "storm_gargoyle", "mirror_duelist"]
	var reserved: Dictionary = {}
	var hidden_cell: Vector2i = Maze.point(spec["markers"]["key"])
	for definition in spec["features"]:
		reserved[Maze.cell_key(definition["cell"])] = true
		if definition["kind"] in ["secret_staff", "secret_spear"] or (index not in [0, 2] and definition["kind"] == "loot"):
			hidden_cell = definition["cell"]
	var entry: Vector2i = Maze.point(spec["markers"]["entry"])
	var boss_cell: Vector2i = Maze.point(spec["markers"]["boss"])
	var candidates: Array[Dictionary] = []
	for z in range(spec["grid"].size()):
		for x in range(str(spec["grid"][z]).length()):
			var cell: Vector2i = Vector2i(x, z)
			if not Maze.is_open(spec["grid"], cell) or reserved.has(Maze.cell_key(cell)):
				continue
			if absi(x - entry.x) + absi(z - entry.y) < 8 or absi(x - boss_cell.x) + absi(z - boss_cell.y) < 5:
				continue
			candidates.append({"cell": cell, "score": posmod(x * 37 + z * 17 + int(spec["seed"]), 101)})
	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["score"] < b["score"])
	var result: Array[Dictionary] = []
	for candidate in candidates:
		var cell: Vector2i = candidate["cell"]
		var separated: bool = true
		for existing in result:
			var other: Vector2i = existing["cell"]
			if absi(cell.x - other.x) + absi(cell.y - other.y) < 4:
				separated = false
		if separated:
			result.append({"id": rosters[index][result.size() % rosters[index].size()], "position": cell_to_world(cell) + Vector3(0, 0.05, 0), "cell": cell})
		if result.size() == 7:
			break
	result.append({"id": hidden_ids[index], "position": cell_to_world(hidden_cell) + Vector3(0, 0.05, 0), "cell": hidden_cell, "hidden": true, "unlock_flag": "hidden_guardian_awake"})
	return result

func _material(key: String, color_value: Color, texture_name: String = "") -> StandardMaterial3D:
	if _materials.has(key):
		return _materials[key]
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = color_value
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.roughness = 1.0
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	if not texture_name.is_empty():
		var path: String = "res:/" + "/assets/textures/" + texture_name
		if ResourceLoader.exists(path):
			material.albedo_texture = load(path)
	_materials[key] = material
	return material

func _multimesh(name_value: String, transforms: Array[Transform3D], material: Material) -> void:
	var instance: MultiMeshInstance3D = MultiMeshInstance3D.new()
	instance.name = name_value
	var batch: MultiMesh = MultiMesh.new()
	batch.transform_format = MultiMesh.TRANSFORM_3D
	var cube: BoxMesh = BoxMesh.new()
	cube.size = Vector3.ONE
	batch.mesh = cube
	batch.instance_count = transforms.size()
	for i in range(transforms.size()):
		batch.set_instance_transform(i, transforms[i])
	instance.multimesh = batch
	instance.material_override = material
	current_floor_node.add_child(instance)

func _collider_runs(rectangles: Array[Dictionary], height: float, y: float, name_value: String) -> int:
	var body: StaticBody3D = StaticBody3D.new()
	body.name = name_value
	body.collision_layer = 1
	body.collision_mask = 0
	for rect in rectangles:
		var cell: Vector2i = rect["cell"]
		var extent: Vector2i = rect["size"]
		var collider: CollisionShape3D = CollisionShape3D.new()
		var box: BoxShape3D = BoxShape3D.new()
		box.size = Vector3(extent.x * cell_size, height, extent.y * cell_size)
		collider.shape = box
		collider.position = cell_to_world(cell) + Vector3((extent.x - 1) * cell_size * 0.5, y, (extent.y - 1) * cell_size * 0.5)
		body.add_child(collider)
	current_floor_node.add_child(body)
	return rectangles.size()

func _box_visual(name_value: String, position_value: Vector3, size_value: Vector3, material: Material) -> MeshInstance3D:
	var mesh_instance: MeshInstance3D = MeshInstance3D.new()
	mesh_instance.name = name_value
	var box: BoxMesh = BoxMesh.new()
	box.size = size_value
	mesh_instance.mesh = box
	mesh_instance.position = position_value
	mesh_instance.material_override = material
	current_floor_node.add_child(mesh_instance)
	return mesh_instance

func _build_geometry() -> void:
	var wall_names: Array[String] = ["wall.jpg", "aqueduct_wall.jpg", "forge_wall.jpg", "gale_wall.jpg", "throne_wall.jpg"]
	var floor_names: Array[String] = ["floor.jpg", "aqueduct_floor.jpg", "forge_floor.jpg", "gale_floor.jpg", "throne_floor.jpg"]
	var wall_material: Material = _material("wall" + str(current_floor), Color.WHITE, wall_names[current_floor])
	var floor_material: Material = _material("floor" + str(current_floor), Color.WHITE, floor_names[current_floor])
	var wall_transforms: Array[Transform3D] = []
	var floor_transforms: Array[Transform3D] = []
	var sand_transforms: Array[Transform3D] = []
	var omitted: Dictionary = {}
	var special: Vector2i = Maze.point(active_spec["markers"]["key" if current_floor == 1 else "gate"])
	if current_floor in [1, 2]:
		omitted[Maze.cell_key(special)] = true
	for z in range(grid.size()):
		for x in range(grid[z].length()):
			var cell: Vector2i = Vector2i(x, z)
			var origin: Vector3 = cell_to_world(cell)
			if grid[z].substr(x, 1) == "#":
				var wall_height: float = 0.65 if current_floor == 0 and x < 5 and z < 5 and (x == 0 or z == 0) else 3.2
				wall_transforms.append(Transform3D(Basis.IDENTITY.scaled(Vector3(cell_size, wall_height, cell_size)), origin + Vector3(0, wall_height * 0.5, 0)))
			elif not omitted.has(Maze.cell_key(cell)):
				var transform: Transform3D = Transform3D(Basis.IDENTITY.scaled(Vector3(cell_size, 0.12, cell_size)), origin + Vector3(0, -0.06, 0))
				if current_floor == 0 and x < 6 and z < 6:
					sand_transforms.append(transform)
				else:
					floor_transforms.append(transform)
	_multimesh("MazeWalls", wall_transforms, wall_material)
	_multimesh("MazeFloor", floor_transforms, floor_material)
	if not sand_transforms.is_empty():
		_multimesh("ShoreSand", sand_transforms, _material("sand", Color(0.7, 0.57, 0.35)))
	var wall_runs: int = _collider_runs(Maze.merged_runs(grid, true), 3.2, 1.6, "MergedWallPhysics")
	var floor_runs: int = _collider_runs(Maze.merged_runs(grid, false, omitted), 0.12, -0.06, "MergedFloorPhysics")
	_stats = {"wall_instances": wall_transforms.size(), "floor_instances": floor_transforms.size() + sand_transforms.size(), "wall_collision_runs": wall_runs, "floor_collision_runs": floor_runs, "wall_batches": 1}
	if current_floor == 0:
		_box_visual("ShoreSea", Vector3(-65, -0.2, -65), Vector3(62, 0.1, 62), _material("sea", Color(0.13, 0.37, 0.5)))
		var entry: Vector3 = active_spec["entry_spawn"]
		for i in range(3):
			var driftwood: MeshInstance3D = _box_visual("Driftwood" + str(i), entry + Vector3(0.5 + i * 0.2, 0.14, -0.9 + i * 0.3), Vector3(0.9, 0.18, 0.22), _material("driftwood", Color(0.36, 0.24, 0.14)))
			driftwood.rotation.y = float(i) * 0.45
	if current_floor == 1:
		_build_dive_pocket(special)
		for key in _hazard_cells:
			var parts: PackedStringArray = str(key).split(":")
			_box_visual("ShallowWater", cell_to_world(Vector2i(int(parts[0]), int(parts[1]))) + Vector3(0, 0.03, 0), Vector3(2.9, 0.04, 2.9), _material("shallow_water", Color(0.16, 0.42, 0.58)))
	if current_floor == 2:
		_build_bridge(special)
		for key in _hazard_cells:
			var parts: PackedStringArray = str(key).split(":")
			_box_visual("HotLava", cell_to_world(Vector2i(int(parts[0]), int(parts[1]))) + Vector3(0, 0.03, 0), Vector3(2.9, 0.04, 2.9), _material("lava", Color(0.95, 0.28, 0.04)))

func _build_dive_pocket(cell: Vector2i) -> void:
	var origin: Vector3 = cell_to_world(cell)
	var body: StaticBody3D = StaticBody3D.new()
	body.name = "SubmergedKeyPocket"
	body.collision_layer = 1
	body.collision_mask = 0
	var positions: Array[Vector3] = [Vector3(0, -3.1, 0), Vector3(-1.5, -1.5, 0), Vector3(1.5, -1.5, 0), Vector3(0, -1.5, -1.5), Vector3(0, -1.5, 1.5)]
	var sizes: Array[Vector3] = [Vector3(3, 0.2, 3), Vector3(0.2, 3, 3), Vector3(0.2, 3, 3), Vector3(3, 3, 0.2), Vector3(3, 3, 0.2)]
	for i in range(positions.size()):
		var shape: CollisionShape3D = CollisionShape3D.new()
		var box: BoxShape3D = BoxShape3D.new()
		box.size = sizes[i]
		shape.shape = box
		shape.position = origin + positions[i]
		body.add_child(shape)
		var stone_material: Material = _material("pocket_floor", Color(0.7, 0.82, 0.86), "aqueduct_floor.jpg") if i == 0 else _material("pocket_wall", Color(0.55, 0.73, 0.8), "aqueduct_wall.jpg")
		_box_visual("PocketStone", origin + positions[i], sizes[i], stone_material)
	for x in [-1.27, 1.27]:
		for z in [-1.27, 1.27]:
			_box_visual("PocketStonePillar", origin + Vector3(x, -1.6, z), Vector3(0.16, 2.8, 0.16), _material("pocket_trim", Color(0.3, 0.48, 0.53)))
	current_floor_node.add_child(body)
	var surface: Material = _material("water_surface", Color(0.17, 0.55, 0.72))
	_box_visual("DiveWaterSurface", origin + Vector3(0, 0.02, 0), Vector3(3, 0.04, 3), surface)

func _build_bridge(cell: Vector2i) -> void:
	var origin: Vector3 = cell_to_world(cell)
	bridge_deck = StaticBody3D.new()
	bridge_deck.name = "LoweredBridgePhysics"
	bridge_deck.collision_layer = 0
	bridge_deck.collision_mask = 0
	var shape: CollisionShape3D = CollisionShape3D.new()
	var box: BoxShape3D = BoxShape3D.new()
	box.size = Vector3(3.0, 0.2, 3.0)
	shape.shape = box
	shape.position = origin + Vector3(0, -0.1, 0)
	bridge_deck.add_child(shape)
	current_floor_node.add_child(bridge_deck)
	bridge_visual = _box_visual("BridgeDeck", origin + Vector3(0, -0.06, 0), Vector3(3.0, 0.12, 3.0), _material("bridge_planks", Color(0.54, 0.35, 0.17)))
	bridge_visual.visible = false
	_box_visual("LavaChasm", origin + Vector3(0, -1.8, 0), Vector3(3.0, 0.08, 3.0), _material("lava", Color(0.95, 0.28, 0.04)))

func _build_landmarks() -> void:
	var landmark_cells: Array = active_spec["markers"].get("landmarks", [])
	var landmark_names: Array = active_spec.get("landmarks", [])
	for i in range(landmark_cells.size()):
		var origin: Vector3 = cell_to_world(Maze.point(landmark_cells[i]))
		_box_visual("Landmark" + str(i), origin + Vector3(0.95, 1.0, 0.85), Vector3(0.65, 2.0, 0.65), _material("landmark" + str(current_floor), active_spec["color"].lightened(0.2)))
		var label: Label3D = Label3D.new()
		label.position = origin + Vector3(0, 2.5, 0)
		label.text = str(landmark_names[i]) if i < landmark_names.size() else "Landmark"
		label.font_size = 28
		label.pixel_size = 0.0015
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.visibility_range_begin = 2.5
		label.visibility_range_end = 10.0
		current_floor_node.add_child(label)

func begin_dive(player: Node) -> void:
	if state == null or not state.has_item("tide_charm"):
		notify("The Tide Charm is needed to breathe below the water.")
		return
	var key_cell: Vector2i = Maze.point(active_spec["markers"]["key"])
	player.global_position = cell_to_world(key_cell) + Vector3(0, -2.95, 0.85)
	player.rotation.y = 0.0
	player.velocity = Vector3.ZERO
	if player.has_method("set_diving"):
		player.set_diving(true)
	if "camera" in player and is_instance_valid(player.camera):
		player.camera.rotation.x = -0.5
		_prior_camera_environment = player.camera.environment
		_underwater_environment = Environment.new()
		_underwater_environment.background_mode = Environment.BG_COLOR
		_underwater_environment.background_color = Color(0.04, 0.16, 0.25)
		_underwater_environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		_underwater_environment.ambient_light_color = Color(0.3, 0.55, 0.7)
		_underwater_environment.ambient_light_energy = 0.65
		_underwater_environment.fog_enabled = true
		_underwater_environment.fog_light_color = Color(0.1, 0.35, 0.5)
		_underwater_environment.fog_density = 0.05
		player.camera.environment = _underwater_environment
	notify("Underwater: recover the Tide Key, then use the return bubbles.")

func end_dive(player: Node) -> void:
	var station: Node = features.get("dive_station")
	if not is_instance_valid(station):
		return
	player.global_position = cell_to_world(station.data["cell"]) + Vector3(0, 0.08, 0)
	player.velocity = Vector3.ZERO
	if player.has_method("set_diving"):
		player.set_diving(false)
	if "camera" in player and is_instance_valid(player.camera):
		player.camera.environment = _prior_camera_environment
	notify("Returned to the dry passage.")

func fire_hazard_damage(chasm: bool = false) -> float:
	if state == null or not state.has_item("ember_sigil"):
		return 35.0 if chasm else 12.0
	var tier: int = clampi(state.tool_level("ember_sigil"), 1, 3)
	return 35.0 - 7.0 * float(tier - 1) if chasm else 4.0 - float(tier)

func _physics_process(delta: float) -> void:
	_hazard_clock += delta
	_burn_cooldown = maxf(0.0, _burn_cooldown - delta)
	if _hazard_clock < 0.1 or current_floor_node == null:
		return
	_hazard_clock = 0.0
	for player in get_tree().get_nodes_in_group("adventure_player"):
		if not player is CharacterBody3D:
			continue
		var cell: Vector2i = world_to_cell(player.global_position)
		if current_floor == 2 and _burn_cooldown <= 0.0:
			var chasm: bool = cell == Maze.point(active_spec["markers"]["gate"]) and player.global_position.y < -0.35
			if chasm or _hazard_cells.has(Maze.cell_key(cell)):
				var damage: float = fire_hazard_damage(chasm)
				player.take_damage(damage, cell_to_world(cell))
				_burn_cooldown = 0.8
		if player.global_position.y < -8.0 and current_floor != 1:
			player.take_damage(200.0, player.global_position)
