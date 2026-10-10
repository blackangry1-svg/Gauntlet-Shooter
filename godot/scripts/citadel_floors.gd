class_name CitadelFloors
extends Node3D

signal floor_loaded(floor_index: int, floor_name: String)

var SanctuaryScript = load("res:/" + "/scripts/sanctuary.gd")
var StalkerMinotaurScript = load("res:/" + "/scripts/stalker_minotaur.gd")
var AsterionBossScript = load("res:/" + "/scripts/asterion_boss.gd")
var CitadelEnemyScript = load("res:/" + "/scripts/enemy.gd")

var current_floor_node: Node3D = null
var current_floor_index: int = 0
var active_stalker: Node = null

const FLOOR_CONFIGS = [
	{
		"index": 0,
		"name": "Floor 1: Icarus Beach Shoreline & Crypt of the Damned",
		"wall_tex": "res:/" + "/assets/textures/wall.jpg",
		"floor_tex": "res:/" + "/assets/textures/floor.jpg",
		"ambient_color": Color(0.18, 0.22, 0.28),
		"fog_density": 0.015,
		"spawn_stalker": false,
		"spawn_asterion": false,
		"spawn_sanctuary": true
	},
	{
		"index": 1,
		"name": "Floor 2: Sunken Aqueduct & The Labyrinth",
		"wall_tex": "res:/" + "/assets/textures/aqueduct_wall.jpg",
		"floor_tex": "res:/" + "/assets/textures/aqueduct_floor.jpg",
		"ambient_color": Color(0.12, 0.20, 0.22),
		"fog_density": 0.025,
		"spawn_stalker": true,
		"spawn_asterion": true,
		"spawn_sanctuary": true
	},
	{
		"index": 2,
		"name": "Floor 3: Magma Foundry & Abyssal Forge",
		"wall_tex": "res:/" + "/assets/textures/forge_wall.jpg",
		"floor_tex": "res:/" + "/assets/textures/forge_floor.jpg",
		"ambient_color": Color(0.32, 0.14, 0.08),
		"fog_density": 0.02,
		"spawn_stalker": true,
		"spawn_asterion": false,
		"spawn_sanctuary": true
	},
	{
		"index": 3,
		"name": "Floor 4: Gale Ramparts & Sky High Walkway",
		"wall_tex": "res:/" + "/assets/textures/gale_wall.jpg",
		"floor_tex": "res:/" + "/assets/textures/gale_floor.jpg",
		"ambient_color": Color(0.20, 0.26, 0.35),
		"fog_density": 0.012,
		"spawn_stalker": true,
		"spawn_asterion": false,
		"spawn_sanctuary": true
	},
	{
		"index": 4,
		"name": "Floor 5: Wizard King's Cathedral & Celestial Throne",
		"wall_tex": "res:/" + "/assets/textures/throne_wall.jpg",
		"floor_tex": "res:/" + "/assets/textures/throne_floor.jpg",
		"ambient_color": Color(0.35, 0.30, 0.40),
		"fog_density": 0.008,
		"spawn_stalker": false,
		"spawn_asterion": false,
		"spawn_sanctuary": true
	}
]

func load_floor(floor_idx: int) -> Node3D:
	if current_floor_node != null:
		current_floor_node.queue_free()
		
	current_floor_index = clamp(floor_idx, 0, 4)
	var cfg = FLOOR_CONFIGS[current_floor_index]
	
	current_floor_node = Node3D.new()
	current_floor_node.name = "CitadelFloor_" + str(current_floor_index)
	add_child(current_floor_node)
	
	_build_floor_geometry(cfg)
	_spawn_floor_entities(cfg)
	
	floor_loaded.emit(current_floor_index, cfg["name"])
	return current_floor_node

static func load_texture_safe(path: String) -> Texture2D:
	if ResourceLoader.exists(path):
		var res = load(path)
		if res is Texture2D:
			return res
	if FileAccess.file_exists(path):
		var img = Image.load_from_file(path)
		if img != null:
			return ImageTexture.create_from_image(img)
	return null

func _build_floor_geometry(cfg: Dictionary) -> void:
	var floor_mat = StandardMaterial3D.new()
	var floor_tex = load_texture_safe(cfg["floor_tex"])
	if floor_tex != null:
		floor_mat.albedo_texture = floor_tex
		floor_mat.uv1_scale = Vector3(16, 16, 1)
	else:
		floor_mat.albedo_color = Color(0.3, 0.3, 0.3)
		
	var wall_mat = StandardMaterial3D.new()
	var wall_tex = load_texture_safe(cfg["wall_tex"])
	if wall_tex != null:
		wall_mat.albedo_texture = wall_tex
		wall_mat.uv1_scale = Vector3(8, 4, 1)
	else:
		wall_mat.albedo_color = Color(0.25, 0.25, 0.25)
		
	var ground = StaticBody3D.new()
	var g_mesh = MeshInstance3D.new()
	var plane = PlaneMesh.new()
	plane.size = Vector2(80, 80)
	g_mesh.mesh = plane
	g_mesh.material_override = floor_mat
	ground.add_child(g_mesh)
	
	var g_col = CollisionShape3D.new()
	var g_box = BoxShape3D.new()
	g_box.size = Vector3(80, 0.2, 80)
	g_col.shape = g_box
	g_col.position.y = -0.1
	ground.add_child(g_col)
	current_floor_node.add_child(ground)
	
	# Perimeter boundary walls
	_create_wall(Vector3(0, 3, -40), Vector3(80, 6, 1), wall_mat)
	_create_wall(Vector3(0, 3, 40), Vector3(80, 6, 1), wall_mat)
	_create_wall(Vector3(-40, 3, 0), Vector3(1, 6, 80), wall_mat)
	_create_wall(Vector3(40, 3, 0), Vector3(1, 6, 80), wall_mat)
	
	# Architecture by floor theme
	match current_floor_index:
		0:
			_build_beach_crypt_layout(wall_mat)
		1:
			_build_labyrinth_maze_layout(wall_mat)
		2:
			_build_magma_foundry_layout(wall_mat)
		3:
			_build_gale_ramparts_layout(wall_mat)
		4:
			_build_cathedral_throne_layout(wall_mat)
	
	_create_ascension_portal(Vector3(0, 0, 35))

func _build_beach_crypt_layout(mat: Material) -> void:
	# Shoreline Crypt mausoleum colonnades and crypt pillars
	for x in [-12.0, 12.0]:
		for z in [-15.0, 0.0, 15.0]:
			_create_pillar(Vector3(x, 3, z), Vector3(2.5, 6, 2.5), mat)
	_create_wall(Vector3(-22, 3, 0), Vector3(18, 6, 1), mat)
	_create_wall(Vector3(22, 3, 0), Vector3(18, 6, 1), mat)
	_create_wall(Vector3(0, 3, -10), Vector3(1, 6, 14), mat)

func _build_labyrinth_maze_layout(mat: Material) -> void:
	# Winding Labyrinth corridors and Asterion's hidden secret inner sanctum
	# Outer maze partition corridors
	_create_wall(Vector3(-15, 3, -10), Vector3(26, 6, 1.2), mat)
	_create_wall(Vector3(15, 3, -10), Vector3(26, 6, 1.2), mat)
	_create_wall(Vector3(-10, 3, 10), Vector3(36, 6, 1.2), mat)
	_create_wall(Vector3(10, 3, 20), Vector3(36, 6, 1.2), mat)
	
	# Cross corridors creating turns and dead-ends
	_create_wall(Vector3(-28, 3, 5), Vector3(1.2, 6, 28), mat)
	_create_wall(Vector3(28, 3, 5), Vector3(1.2, 6, 28), mat)
	_create_wall(Vector3(0, 3, 5), Vector3(1.2, 6, 18), mat)
	_create_wall(Vector3(-15, 3, 22), Vector3(1.2, 6, 16), mat)
	_create_wall(Vector3(15, 3, -2), Vector3(1.2, 6, 15), mat)
	
	# Asterion's Secret Inner Sanctum enclosure at (-28, 0, -28)
	_create_wall(Vector3(-28, 3, -18), Vector3(22, 6, 1.2), mat) # Southern sanctum wall
	_create_wall(Vector3(-17, 3, -28), Vector3(1.2, 6, 22), mat) # Eastern sanctum wall
	# Sanctum secret entrance portal pillars
	_create_pillar(Vector3(-17, 3, -20), Vector3(2.5, 6, 2.5), mat)
	_create_pillar(Vector3(-28, 3, -20), Vector3(2.5, 6, 2.5), mat)

func _build_magma_foundry_layout(mat: Material) -> void:
	# Foundry furnaces, smelting catwalks, and magma forge pillars
	for x in [-18.0, 18.0]:
		_create_wall(Vector3(x, 3, -12), Vector3(1.5, 6, 22), mat)
		_create_wall(Vector3(x, 3, 12), Vector3(1.5, 6, 22), mat)
	_create_pillar(Vector3(-8, 3, 0), Vector3(4, 6, 4), mat)
	_create_pillar(Vector3(8, 3, 0), Vector3(4, 6, 4), mat)
	_create_wall(Vector3(0, 3, -16), Vector3(18, 6, 1.5), mat)
	_create_wall(Vector3(0, 3, 16), Vector3(18, 6, 1.5), mat)

func _build_gale_ramparts_layout(mat: Material) -> void:
	# Narrow castle ramparts, parapets, battlements and sky bridge
	_create_wall(Vector3(-14, 3, -15), Vector3(1.2, 6, 35), mat)
	_create_wall(Vector3(14, 3, -15), Vector3(1.2, 6, 35), mat)
	_create_wall(Vector3(-14, 3, 15), Vector3(1.2, 6, 35), mat)
	_create_wall(Vector3(14, 3, 15), Vector3(1.2, 6, 35), mat)
	_create_wall(Vector3(0, 3, -2), Vector3(16, 6, 1.5), mat)
	_create_pillar(Vector3(-25, 3, 0), Vector3(3, 6, 3), mat)
	_create_pillar(Vector3(25, 3, 0), Vector3(3, 6, 3), mat)

func _build_cathedral_throne_layout(mat: Material) -> void:
	# Grand gothic cathedral nave columns leading to the Wizard King's Celestial Throne
	for z in [-18.0, -6.0, 6.0, 18.0]:
		_create_pillar(Vector3(-12, 3.5, z), Vector3(3, 7, 3), mat)
		_create_pillar(Vector3(12, 3.5, z), Vector3(3, 7, 3), mat)
	# Altar throne dais wall
	_create_wall(Vector3(-22, 3, 26), Vector3(18, 6, 1.5), mat)
	_create_wall(Vector3(22, 3, 26), Vector3(18, 6, 1.5), mat)
	
	# Celestial Throne mesh
	var throne = StaticBody3D.new()
	throne.position = Vector3(0, 1.5, 25)
	var t_mesh = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = Vector3(4.0, 3.0, 2.5)
	t_mesh.mesh = box
	var gold_mat = StandardMaterial3D.new()
	gold_mat.albedo_color = Color(0.7, 0.55, 0.2)
	gold_mat.metallic = 0.8
	t_mesh.material_override = gold_mat
	throne.add_child(t_mesh)
	current_floor_node.add_child(throne)

func _create_pillar(pos: Vector3, size: Vector3, mat: Material) -> void:
	_create_wall(pos, size, mat)

func _create_wall(pos: Vector3, size: Vector3, mat: Material) -> void:
	var wall = StaticBody3D.new()
	wall.position = pos
	wall.add_to_group("walls")
	wall.collision_layer = 1
	wall.collision_mask = 1
	
	var w_mesh = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = size
	w_mesh.mesh = box
	w_mesh.material_override = mat
	wall.add_child(w_mesh)
	
	var w_col = CollisionShape3D.new()
	var col_shape = BoxShape3D.new()
	col_shape.size = size
	w_col.shape = col_shape
	wall.add_child(w_col)
	
	current_floor_node.add_child(wall)

func _create_ascension_portal(pos: Vector3) -> void:
	var portal = Area3D.new()
	portal.position = pos
	portal.name = "AscensionPortal"
	
	var p_col = CollisionShape3D.new()
	var sph = SphereShape3D.new()
	sph.radius = 2.5
	p_col.shape = sph
	portal.add_child(p_col)
	
	var arch_mesh = MeshInstance3D.new()
	var tor = TorusMesh.new()
	tor.inner_radius = 1.8
	tor.outer_radius = 2.4
	arch_mesh.mesh = tor
	arch_mesh.rotation_degrees.x = 90.0
	arch_mesh.position.y = 2.0
	var p_mat = StandardMaterial3D.new()
	p_mat.albedo_color = Color(0.2, 0.8, 1.0)
	p_mat.emission_enabled = true
	p_mat.emission = Color(0.3, 0.9, 1.0)
	p_mat.emission_energy_multiplier = 4.0
	arch_mesh.material_override = p_mat
	portal.add_child(arch_mesh)
	
	portal.body_entered.connect(func(body):
		if body.is_in_group("player"):
			var global_s = Engine.get_main_loop().root.get_node_or_null("Global")
			if global_s:
				global_s.advance_floor()
	)
	current_floor_node.add_child(portal)

func _spawn_floor_entities(cfg: Dictionary) -> void:
	if cfg["spawn_sanctuary"]:
		var sanctuary = SanctuaryScript.new()
		sanctuary.position = Vector3(0, 0, -25)
		current_floor_node.add_child(sanctuary)
		
	if cfg["spawn_stalker"]:
		active_stalker = StalkerMinotaurScript.new()
		active_stalker.position = Vector3(25, 0, 0)
		current_floor_node.add_child(active_stalker)
	else:
		active_stalker = null
		
	if cfg["spawn_asterion"]:
		var asterion = AsterionBossScript.new()
		asterion.position = Vector3(-28, 0, -28)
		current_floor_node.add_child(asterion)
		
	_spawn_citadel_monsters()

func _spawn_citadel_monsters() -> void:
	match current_floor_index:
		0:
			_spawn_enemy(0, Vector3(12, 0, -10))
			_spawn_enemy(0, Vector3(-12, 0, 10))
			_spawn_enemy(1, Vector3(20, 0, 15))
			_spawn_enemy(1, Vector3(-20, 0, -15))
		1:
			_spawn_enemy(0, Vector3(18, 0, 12))
			_spawn_enemy(1, Vector3(-18, 0, 20))
			_spawn_enemy(0, Vector3(5, 0, -5))
		2:
			_spawn_enemy(2, Vector3(10, 0, 10))
			_spawn_enemy(2, Vector3(-10, 0, -10))
			_spawn_enemy(2, Vector3(0, 0, 18))
		3:
			_spawn_enemy(0, Vector3(15, 0, 0))
			_spawn_enemy(1, Vector3(-15, 0, 15))
			_spawn_enemy(3, Vector3(0, 0, 12))
		4:
			_spawn_enemy(3, Vector3(-8, 0, 15))
			_spawn_enemy(3, Vector3(8, 0, 15))
			_spawn_enemy(1, Vector3(0, 0, 22))

func _spawn_enemy(type_idx: int, pos: Vector3) -> void:
	var enemy = CitadelEnemyScript.new()
	enemy.enemy_type = type_idx
	enemy.position = pos
	current_floor_node.add_child(enemy)

func reset_stalker_position() -> void:
	if active_stalker != null and is_instance_valid(active_stalker) and active_stalker.has_method("reset_to_spawn"):
		active_stalker.reset_to_spawn()
