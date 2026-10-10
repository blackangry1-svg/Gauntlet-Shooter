class_name AdventureGame
extends Node3D

var WorldScript = load("res:/" + "/scripts/adventure_world.gd")
var PlayerScript = load("res:/" + "/scripts/adventure_player.gd")
var DirectorScript = load("res:/" + "/scripts/adventure_director.gd")
var HUDScript = load("res:/" + "/scripts/adventure_hud.gd")
var world
var player
var director
var hud
var environment: Environment
var pending_floor: int = -1
var state: Node

func _ready() -> void:
	state = get_tree().root.get_node("Adventure")
	var legacy: Node = get_tree().root.get_node_or_null("Global")
	if legacy != null:
		legacy.process_mode = Node.PROCESS_MODE_DISABLED
	if DisplayServer.get_name() != "headless":
		Engine.max_fps = 60
	_setup_environment()
	world = WorldScript.new()
	world.name = "MazeWorld"
	add_child(world)
	world.configure(state)
	player = PlayerScript.new()
	player.name = "Hero"
	player.configure(state)
	add_child(player)
	director = DirectorScript.new()
	director.name = "Encounters"
	add_child(director)
	director.configure(state, world, player)
	hud = HUDScript.new()
	hud.name = "AdventureHUD"
	add_child(hud)
	hud.configure(state, world, player, director)
	world.floor_built.connect(_on_floor_built)
	world.travel_requested.connect(_travel)
	world.message.connect(hud.show_message)
	world.merchant_requested.connect(hud.show_merchant)
	player.message.connect(hud.show_message)
	state.message.connect(hud.show_message)
	director.message.connect(hud.show_message)
	state.floor_changed.connect(_request_floor)
	player.died.connect(_on_died)
	_load_floor(state.current_floor)

func _setup_environment() -> void:
	var holder := WorldEnvironment.new()
	environment = Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.62, 0.68, 0.75)
	environment.ambient_light_energy = 0.8
	environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	environment.fog_enabled = true
	environment.fog_density = 0.016
	holder.environment = environment
	add_child(holder)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, -25, 0)
	sun.light_energy = 0.65
	sun.shadow_enabled = false
	add_child(sun)

func _request_floor(index: int) -> void:
	pending_floor = index
	call_deferred("_apply_floor_request")

func _apply_floor_request() -> void:
	if pending_floor < 0:
		return
	var index: int = pending_floor
	pending_floor = -1
	_load_floor(index)

func _load_floor(index: int) -> void:
	world.load_floor(index)

func _on_floor_built(index: int) -> void:
	player.cancel_combat()
	player.camera.environment = null
	player.global_position = world.get_spawn_position()
	player.velocity = Vector3.ZERO
	if player.has_method("set_diving"):
		player.set_diving(false)
	var cell: Vector2i = world.world_to_cell(player.global_position)
	for direction in [Vector2i(0, 1), Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, -1)]:
		if world.is_walkable(cell + direction):
			player.rotation.y = atan2(-float(direction.x), -float(direction.y))
			break
	var spec: Dictionary = world.get_floor_spec(index)
	var color: Color = spec.get("color", Color(0.25, 0.35, 0.3))
	environment.background_color = color.darkened(0.55)
	environment.fog_light_color = color.lightened(0.2)
	director.load_floor(index)
	hud.show_message("Entered " + str(spec.get("name", "the labyrinth")) + ". Find the local key and a return route.")
	hud.refresh_floor()

func _travel(index: int) -> void:
	if not state.change_floor(index):
		hud.show_message("The tower is still sealed. Check your journal for the missing relic.")

func _on_died() -> void:
	hud.show_message("The tower returns you to your last refuge. Earned equipment and opened passages remain.")
	await get_tree().create_timer(1.2).timeout
	var checkpoint: int = state.checkpoint_floor
	var changed_floor: bool = checkpoint != state.current_floor
	if changed_floor:
		state.change_floor(checkpoint)
		await world.floor_built
	player.checkpoint_respawn(world.cell_to_world(state.checkpoint_cell) + Vector3(0, 0.08, 0))
	player.camera.environment = null
	if not changed_floor:
		director.load_floor(state.current_floor)
	state.save_game()

func quality(scale: float) -> void:
	get_viewport().scaling_3d_scale = clampf(scale, 0.5, 1.0)
