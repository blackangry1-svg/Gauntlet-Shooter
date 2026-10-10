class_name StalkerMinotaur
extends CharacterBody3D

enum StalkerState {
	LURKING,
	SEARCHING,
	HUNTING,
	REPELLED,
	STAGGERED
}

var AudioSynthScript = load("res:/" + "/scripts/audio_synth.gd")

@export var walk_speed: float = 3.6
@export var sprint_speed: float = 7.4
@export var attack_damage: float = 36.0
@export var attack_range: float = 2.8
@export var detection_range: float = 22.0

var current_state: StalkerState = StalkerState.LURKING
var target_player: CharacterBody3D = null
var dread_contribution: float = 0.0
var home_spawn_pos: Vector3 = Vector3.ZERO

var _attack_cooldown: float = 0.0
var _taunt_timer: float = 8.0
var _heartbeat_timer: float = 0.0
var _breathing_timer: float = 0.0
var _state_timer: float = 0.0
var _flinch_timer: float = 0.0
var _last_known_player_pos: Vector3 = Vector3.ZERO
var _visual_mesh: Node3D
var _audio_synth: Node

const DYNAMIC_TAUNTS = [
	"YOUR FLESH WILL FEED THE LABYRINTH!",
	"NO ESCAPE FROM THE HORNED GOD!",
	"I SMELL YOUR SWEAT, MORTAL!",
	"RUN, LITTLE INSECT!",
	"I HEAR EVERY LABORED BREATH YOU DRAW!",
	"THIS CITADEL IS YOUR TOMB!"
]

func _ready() -> void:
	add_to_group("minotaur_stalker")
	add_to_group("enemy")
	home_spawn_pos = position
	_setup_visuals()
	
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton and global_singleton.audio_synth != null:
		_audio_synth = global_singleton.audio_synth
	else:
		_audio_synth = AudioSynthScript.new()
		add_child(_audio_synth)

func _setup_visuals() -> void:
	_visual_mesh = Node3D.new()
	add_child(_visual_mesh)
	
	var body = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = Vector3(1.4, 2.2, 1.0)
	body.mesh = box
	body.position.y = 1.6
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.28, 0.16, 0.12)
	body.material_override = mat
	_visual_mesh.add_child(body)
	
	var head = MeshInstance3D.new()
	var sphere = SphereMesh.new()
	sphere.radius = 0.45
	sphere.height = 0.9
	head.mesh = sphere
	head.position = Vector3(0, 2.8, 0.3)
	head.material_override = mat
	_visual_mesh.add_child(head)
	
	var horn_l = MeshInstance3D.new()
	var horn_mesh = CylinderMesh.new()
	horn_mesh.top_radius = 0.05
	horn_mesh.bottom_radius = 0.16
	horn_mesh.height = 0.9
	horn_l.mesh = horn_mesh
	horn_l.position = Vector3(-0.55, 3.1, 0.2)
	horn_l.rotation_degrees = Vector3(15, 0, -45)
	var horn_mat = StandardMaterial3D.new()
	horn_mat.albedo_color = Color(0.85, 0.8, 0.7)
	horn_l.material_override = horn_mat
	_visual_mesh.add_child(horn_l)
	
	var horn_r = MeshInstance3D.new()
	horn_r.mesh = horn_mesh
	horn_r.position = Vector3(0.55, 3.1, 0.2)
	horn_r.rotation_degrees = Vector3(15, 0, 45)
	horn_r.material_override = horn_mat
	_visual_mesh.add_child(horn_r)
	
	var eye_l = OmniLight3D.new()
	eye_l.light_color = Color(1.0, 0.1, 0.1)
	eye_l.light_energy = 2.0
	eye_l.omni_range = 3.0
	eye_l.position = Vector3(-0.2, 2.85, 0.65)
	_visual_mesh.add_child(eye_l)
	
	var eye_r = OmniLight3D.new()
	eye_r.light_color = Color(1.0, 0.1, 0.1)
	eye_r.light_energy = 2.0
	eye_r.omni_range = 3.0
	eye_r.position = Vector3(0.2, 2.85, 0.65)
	_visual_mesh.add_child(eye_r)
	
	var col = CollisionShape3D.new()
	var cap = CapsuleShape3D.new()
	cap.radius = 0.8
	cap.height = 2.8
	col.shape = cap
	col.position.y = 1.4
	add_child(col)

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= 18.0 * delta
	
	if target_player == null and get_tree() != null:
		var players = get_tree().get_nodes_in_group("player")
		if players.size() > 0:
			target_player = players[0]
	
	if target_player != null:
		_process_stalker_ai(delta)
	
	_attack_cooldown = max(0.0, _attack_cooldown - delta)
	_taunt_timer -= delta
	if _taunt_timer <= 0.0:
		_emit_dynamic_taunt()
		_taunt_timer = randf_range(12.0, 20.0)
	
	move_and_slide()

func _process_stalker_ai(delta: float) -> void:
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	var dist = global_position.distance_to(target_player.global_position)
	
	_process_audio_cues(delta, dist)
	
	if global_singleton:
		var dread_target = 0.0
		if not global_singleton.is_in_sanctuary:
			if dist < 8.0:
				dread_target = 100.0
			elif dist < 16.0:
				dread_target = 65.0
			elif dist < 28.0:
				dread_target = 35.0
			else:
				dread_target = 10.0
		global_singleton.set_dread(lerp(global_singleton.dread_meter, dread_target, delta * 1.5))
	
	if global_singleton and global_singleton.is_in_sanctuary:
		current_state = StalkerState.REPELLED
	
	if _flinch_timer > 0.0:
		_flinch_timer -= delta
		velocity.x = 0.0
		velocity.z = 0.0
		return
	
	match current_state:
		StalkerState.LURKING:
			if dist < 14.0:
				current_state = StalkerState.HUNTING
				if _audio_synth and _audio_synth.roar_wav:
					_audio_synth.play_sfx_3d(_audio_synth.roar_wav, global_position, 6.0)
			else:
				_move_towards(target_player.global_position, walk_speed)
				
		StalkerState.SEARCHING:
			_move_towards(_last_known_player_pos, walk_speed * 1.2)
			if global_position.distance_to(_last_known_player_pos) < 2.0 or dist < 14.0:
				current_state = StalkerState.HUNTING
				
		StalkerState.HUNTING:
			_last_known_player_pos = target_player.global_position
			_move_towards(target_player.global_position, sprint_speed)
			if dist <= attack_range and _attack_cooldown <= 0.0:
				_execute_stalker_attack()
				
		StalkerState.REPELLED:
			if global_singleton and global_singleton.active_bonfire_position != Vector3.ZERO:
				var away_dir = (global_position - global_singleton.active_bonfire_position).normalized()
				velocity.x = away_dir.x * walk_speed
				velocity.z = away_dir.z * walk_speed
				if global_position.distance_to(global_singleton.active_bonfire_position) > 16.0:
					current_state = StalkerState.LURKING
			else:
				current_state = StalkerState.LURKING

func _move_towards(target_pos: Vector3, speed: float) -> void:
	var dir = (target_pos - global_position)
	dir.y = 0.0
	if dir.length() > 0.1:
		dir = dir.normalized()
		velocity.x = dir.x * speed
		velocity.z = dir.z * speed
		if dir.cross(Vector3.UP).length() > 0.01:
			_visual_mesh.look_at(global_position + dir, Vector3.UP)

func _process_audio_cues(delta: float, dist: float) -> void:
	_heartbeat_timer -= delta
	var heartbeat_interval = clamp(dist / 22.0, 0.45, 1.4)
	if _heartbeat_timer <= 0.0:
		_heartbeat_timer = heartbeat_interval
		var vol = clamp((1.0 - (dist / 35.0)) * 6.0, -20.0, 6.0)
		if _audio_synth and _audio_synth.heartbeat_wav:
			_audio_synth.play_sfx_3d(_audio_synth.heartbeat_wav, global_position, vol)
		if dist < 9.0:
			Input.start_joy_vibration(0, 0.22, 0.12, 0.1)
	
	_breathing_timer -= delta
	if _breathing_timer <= 0.0:
		_breathing_timer = randf_range(3.0, 5.5)
		if dist < 25.0 and _audio_synth and _audio_synth.breathing_wav:
			var vol_b = clamp((1.0 - (dist / 25.0)) * 4.0, -18.0, 4.0)
			_audio_synth.play_sfx_3d(_audio_synth.breathing_wav, global_position, vol_b)

func _emit_dynamic_taunt() -> void:
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	var line = DYNAMIC_TAUNTS[randi() % DYNAMIC_TAUNTS.size()]
	if global_singleton:
		global_singleton.taunt_emitted.emit("MINOTAUR STALKER", line)
	if _audio_synth and _audio_synth.roar_wav:
		_audio_synth.play_sfx_3d(_audio_synth.roar_wav, global_position, 4.0)

func _execute_stalker_attack() -> void:
	_attack_cooldown = 1.3
	if _audio_synth and _audio_synth.swing_wav:
		_audio_synth.play_sfx_3d(_audio_synth.swing_wav, global_position, 3.0)
	if target_player and target_player.has_method("take_damage"):
		var atk_dir = (target_player.global_position - global_position).normalized()
		# If player has Aegis and is blocking, repel the stalker
		if target_player.is_blocking and target_player.has_aegis_shield:
			repel_from_sanctuary(target_player.global_position, 5.0)
			target_player.take_damage(attack_damage * 0.1, 0.2, atk_dir)
			return
		target_player.take_damage(attack_damage, 0.6, atk_dir)

func take_damage(amount: float, stagger_dur: float = 0.4, impact_dir: Vector3 = Vector3.ZERO) -> void:
	_flinch_timer = min(stagger_dur, 0.45)
	current_state = StalkerState.HUNTING
	if _audio_synth and _audio_synth.impact_wav:
		_audio_synth.play_sfx_3d(_audio_synth.impact_wav, global_position, 4.0)
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton:
		global_singleton.taunt_emitted.emit("MINOTAUR STALKER", "PUNY BLOWS CANNOT SLAY THE IMMORTAL BEAST!")

func repel_from_sanctuary(sanctuary_pos: Vector3, radius: float) -> void:
	current_state = StalkerState.REPELLED
	var push = (global_position - sanctuary_pos)
	push.y = 0.0
	if push.length() < 0.1:
		push = Vector3(1, 0, 0)
	else:
		push = push.normalized()
	velocity.x = push.x * sprint_speed
	velocity.z = push.z * sprint_speed
	_flinch_timer = 0.5
	if _audio_synth and _audio_synth.roar_wav:
		_audio_synth.play_sfx_3d(_audio_synth.roar_wav, global_position, 6.0)

func reset_to_spawn() -> void:
	position = home_spawn_pos if home_spawn_pos != Vector3.ZERO else Vector3(25, 0, 0)
	velocity = Vector3.ZERO
	current_state = StalkerState.LURKING
	_flinch_timer = 0.0
	_attack_cooldown = 2.0
