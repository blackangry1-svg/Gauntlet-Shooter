class_name MainGame
extends Node3D

var CitadelFloorsScript = load("res:/" + "/scripts/citadel_floors.gd")
var SoulsPlayerScript = load("res:/" + "/scripts/player.gd")
var SoulsHUDScript = load("res:/" + "/scripts/hud.gd")

var citadel: Node3D
var player: CharacterBody3D
var hud: CanvasLayer
var env: WorldEnvironment
var sun: DirectionalLight3D

func _ready() -> void:
	_setup_environment()
	_setup_subsystems()
	_load_current_floor()

func _setup_environment() -> void:
	env = WorldEnvironment.new()
	var environment = Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.08, 0.08, 0.12)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.4, 0.4, 0.45)
	environment.ambient_light_energy = 1.0
	env.environment = environment
	add_child(env)
	
	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-45, 30, 0)
	sun.light_color = Color(0.9, 0.85, 0.8)
	sun.light_energy = 1.2
	add_child(sun)

func _setup_subsystems() -> void:
	citadel = CitadelFloorsScript.new()
	add_child(citadel)
	
	hud = SoulsHUDScript.new()
	add_child(hud)
	
	player = SoulsPlayerScript.new()
	player.position = Vector3(0, 1.2, -20)
	add_child(player)
	
	player.stats_changed.connect(hud.update_stats)
	player.weapon_switched.connect(hud.update_weapon)
	player.estus_used.connect(hud.update_estus)
	if player.has_method("_emit_stats"):
		player._emit_stats()
	
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton:
		global_singleton.floor_changed.connect(_on_floor_changed)
		global_singleton.player_died.connect(_on_player_died)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.keycode == KEY_ESCAPE and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _load_current_floor() -> void:
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	var f_idx = int(global_singleton.current_floor_index) if global_singleton else 0
	citadel.load_floor(f_idx)
	
	if player:
		player.position = Vector3(0, 1.2, -22)
		player.rotation.y = PI
		player.velocity = Vector3.ZERO

func _on_floor_changed(new_floor: int) -> void:
	citadel.load_floor(new_floor)
	if player:
		player.position = Vector3(0, 1.2, -22)
		player.rotation.y = PI
		player.velocity = Vector3.ZERO

func _on_player_died() -> void:
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton:
		global_singleton.taunt_emitted.emit("YOU DIED", "Restoring to the Sacred Bonfire...")
	await get_tree().create_timer(2.0).timeout
	if player:
		player.rest_at_bonfire()
		player.position = Vector3(0, 1.2, -20)
		player.rotation.y = PI
		player.velocity = Vector3.ZERO
		if citadel.has_method("reset_stalker_position"):
			citadel.reset_stalker_position()
		if global_singleton:
			global_singleton.player_respawned.emit()
