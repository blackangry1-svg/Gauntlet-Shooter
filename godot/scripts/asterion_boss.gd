class_name AsterionBoss
extends CharacterBody3D

signal defeated()

enum BossState {
	IDLE,
	CHASE,
	ATTACK_CLEAVE,
	ATTACK_CHARGE,
	ATTACK_GROUND_SLAM,
	STAGGERED,
	DEAD
}

var AudioSynthScript = load("res:/" + "/scripts/audio_synth.gd")

@export var max_hp: float = 800.0
@export var walk_speed: float = 4.2
@export var charge_speed: float = 11.0

var current_hp: float = 800.0
var current_state: BossState = BossState.IDLE
var target_player: CharacterBody3D = null

var stagger_buildup: float = 0.0
var stagger_threshold: float = 120.0
var stagger_timer: float = 0.0

var _attack_cooldown: float = 2.0
var _charge_timer: float = 0.0
var _charge_dir: Vector3 = Vector3.ZERO
var _visual_mesh: Node3D
var _audio_synth: Node

func _ready() -> void:
	add_to_group("enemy")
	add_to_group("boss")
	current_hp = max_hp
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
	box.size = Vector3(1.8, 2.6, 1.2)
	body.mesh = box
	body.position.y = 1.8
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.65, 0.45, 0.2)
	mat.metallic = 0.7
	mat.roughness = 0.35
	body.material_override = mat
	_visual_mesh.add_child(body)
	
	var head = MeshInstance3D.new()
	var sphere = SphereMesh.new()
	sphere.radius = 0.55
	sphere.height = 1.1
	head.mesh = sphere
	head.position = Vector3(0, 3.2, 0.4)
	head.material_override = mat
	_visual_mesh.add_child(head)
	
	var horn_mat = StandardMaterial3D.new()
	horn_mat.albedo_color = Color(0.9, 0.85, 0.75)
	var horn_mesh = CylinderMesh.new()
	horn_mesh.top_radius = 0.04
	horn_mesh.bottom_radius = 0.2
	horn_mesh.height = 1.2
	
	var horn_l = MeshInstance3D.new()
	horn_l.mesh = horn_mesh
	horn_l.position = Vector3(-0.7, 3.5, 0.25)
	horn_l.rotation_degrees = Vector3(20, 0, -50)
	horn_l.material_override = horn_mat
	_visual_mesh.add_child(horn_l)
	
	var horn_r = MeshInstance3D.new()
	horn_r.mesh = horn_mesh
	horn_r.position = Vector3(0.7, 3.5, 0.25)
	horn_r.rotation_degrees = Vector3(20, 0, 50)
	horn_r.material_override = horn_mat
	_visual_mesh.add_child(horn_r)
	
	var axe = MeshInstance3D.new()
	var axe_mesh = BoxMesh.new()
	axe_mesh.size = Vector3(0.3, 2.8, 0.9)
	axe.mesh = axe_mesh
	axe.position = Vector3(1.2, 2.0, 0.6)
	var axe_mat = StandardMaterial3D.new()
	axe_mat.albedo_color = Color(0.2, 0.2, 0.25)
	axe_mat.metallic = 0.8
	axe.material_override = axe_mat
	_visual_mesh.add_child(axe)
	
	var col = CollisionShape3D.new()
	var cap = CapsuleShape3D.new()
	cap.radius = 1.0
	cap.height = 3.4
	col.shape = cap
	col.position.y = 1.7
	add_child(col)

func _physics_process(delta: float) -> void:
	if current_state == BossState.DEAD:
		return
		
	if not is_on_floor():
		velocity.y -= 20.0 * delta
		
	if target_player == null and get_tree() != null:
		var players = get_tree().get_nodes_in_group("player")
		if players.size() > 0:
			target_player = players[0]
			
	if target_player != null:
		_process_boss_ai(delta)
		
	_attack_cooldown = max(0.0, _attack_cooldown - delta)
	stagger_buildup = max(0.0, stagger_buildup - delta * 15.0)
	
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton:
		global_singleton.boss_health_updated.emit("Asterion, Prince of Crete", current_hp, max_hp)
		
	move_and_slide()

func _process_boss_ai(delta: float) -> void:
	var dist = global_position.distance_to(target_player.global_position)
	
	if current_state == BossState.STAGGERED:
		stagger_timer -= delta
		velocity.x = 0.0
		velocity.z = 0.0
		if stagger_timer <= 0.0:
			current_state = BossState.CHASE
			if _audio_synth and _audio_synth.roar_wav:
				_audio_synth.play_sfx_3d(_audio_synth.roar_wav, global_position, 6.0)
		return
		
	if current_state == BossState.ATTACK_CHARGE:
		_charge_timer -= delta
		velocity.x = _charge_dir.x * charge_speed
		velocity.z = _charge_dir.z * charge_speed
		if dist < 2.5:
			if target_player.has_method("take_damage"):
				target_player.take_damage(55.0, 0.8, _charge_dir)
			if _audio_synth and _audio_synth.impact_wav:
				_audio_synth.play_sfx_3d(_audio_synth.impact_wav, global_position, 5.0)
			Input.start_joy_vibration(0, 0.7, 0.9, 0.4)
			current_state = BossState.CHASE
		if _charge_timer <= 0.0:
			current_state = BossState.CHASE
		return
		
	var look_dir = (target_player.global_position - global_position)
	look_dir.y = 0.0
	if look_dir.length() > 0.1:
		var norm_dir = look_dir.normalized()
		if norm_dir.cross(Vector3.UP).length() > 0.01:
			_visual_mesh.look_at(global_position + norm_dir, Vector3.UP)
		
	if dist > 3.2:
		var move_dir = look_dir.normalized()
		velocity.x = move_dir.x * walk_speed
		velocity.z = move_dir.z * walk_speed
		
		if dist > 8.0 and _attack_cooldown <= 0.0:
			_start_horn_charge()
	else:
		velocity.x = 0.0
		velocity.z = 0.0
		if _attack_cooldown <= 0.0:
			if randf() < 0.6:
				_execute_cleave_attack()
			else:
				_execute_ground_slam()

func _start_horn_charge() -> void:
	current_state = BossState.ATTACK_CHARGE
	_charge_dir = (target_player.global_position - global_position)
	_charge_dir.y = 0.0
	_charge_dir = _charge_dir.normalized()
	_charge_timer = 1.2
	_attack_cooldown = 3.0
	if _audio_synth and _audio_synth.roar_wav:
		_audio_synth.play_sfx_3d(_audio_synth.roar_wav, global_position, 6.0)

func _execute_cleave_attack() -> void:
	_attack_cooldown = 1.6
	if _audio_synth and _audio_synth.swing_wav:
		_audio_synth.play_sfx_3d(_audio_synth.swing_wav, global_position, 4.0)
	if target_player and target_player.has_method("take_damage"):
		var atk_dir = (target_player.global_position - global_position).normalized()
		target_player.take_damage(42.0, 0.6, atk_dir)

func _execute_ground_slam() -> void:
	_attack_cooldown = 2.4
	if _audio_synth and _audio_synth.impact_wav:
		_audio_synth.play_sfx_3d(_audio_synth.impact_wav, global_position, 7.0)
	Input.start_joy_vibration(0, 0.8, 1.0, 0.5)
	var space = get_world_3d().direct_space_state
	var query = PhysicsShapeQueryParameters3D.new()
	var sphere = SphereShape3D.new()
	sphere.radius = 5.0
	query.shape = sphere
	query.transform = Transform3D(Basis(), global_position)
	var hits = space.intersect_shape(query, 16)
	for hit in hits:
		var collider = hit.get("collider")
		if collider and collider.is_in_group("player") and collider.has_method("take_damage"):
			collider.take_damage(50.0, 0.9, (collider.global_position - global_position).normalized())

func take_damage(amount: float, stagger_dur: float = 0.5, impact_dir: Vector3 = Vector3.ZERO) -> void:
	if current_state == BossState.DEAD:
		return
		
	current_hp -= amount
	if _audio_synth and _audio_synth.impact_wav:
		_audio_synth.play_sfx_3d(_audio_synth.impact_wav, global_position, 4.0)
	
	stagger_buildup += amount * (1.8 if stagger_dur > 0.7 else 1.0)
	if stagger_buildup >= stagger_threshold:
		stagger_buildup = 0.0
		current_state = BossState.STAGGERED
		stagger_timer = 2.5
		if _audio_synth and _audio_synth.roar_wav:
			_audio_synth.play_sfx_3d(_audio_synth.roar_wav, global_position, 5.0)
		Input.start_joy_vibration(0, 0.5, 0.8, 0.3)
		
	if current_hp <= 0.0:
		_die()

func _die() -> void:
	current_state = BossState.DEAD
	current_hp = 0.0
	if _audio_synth and _audio_synth.roar_wav:
		_audio_synth.play_sfx_3d(_audio_synth.roar_wav, global_position, 8.0)
	Input.start_joy_vibration(0, 0.9, 1.0, 0.7)
	
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton:
		global_singleton.boss_defeated.emit("Asterion, Prince of Crete")
		global_singleton.taunt_emitted.emit("VICTORY", "ASTERION HAS FALLEN! The Legendary Aegis of the Minotaur materializes!")
		
	_spawn_aegis_pickup()
	defeated.emit()

func _spawn_aegis_pickup() -> void:
	var aegis_node = Area3D.new()
	aegis_node.position = global_position + Vector3(0, 0.5, 0)
	
	var col = CollisionShape3D.new()
	var sph = SphereShape3D.new()
	sph.radius = 1.5
	col.shape = sph
	aegis_node.add_child(col)
	
	var shield_mesh = MeshInstance3D.new()
	var cyl = CylinderMesh.new()
	cyl.top_radius = 0.7
	cyl.bottom_radius = 0.7
	cyl.height = 0.1
	shield_mesh.mesh = cyl
	shield_mesh.rotation_degrees.x = 90.0
	var gold_mat = StandardMaterial3D.new()
	gold_mat.albedo_color = Color(1.0, 0.84, 0.0)
	gold_mat.metallic = 0.95
	gold_mat.emission_enabled = true
	gold_mat.emission = Color(0.9, 0.7, 0.1)
	gold_mat.emission_energy_multiplier = 2.0
	shield_mesh.material_override = gold_mat
	aegis_node.add_child(shield_mesh)
	
	var light = OmniLight3D.new()
	light.light_color = Color(1.0, 0.85, 0.2)
	light.light_energy = 3.0
	aegis_node.add_child(light)
	
	aegis_node.body_entered.connect(func(body):
		if body.is_in_group("player"):
			var global_s = Engine.get_main_loop().root.get_node_or_null("Global")
			if global_s:
				global_s.acquire_aegis()
			aegis_node.queue_free()
	)
	
	var p_node = get_parent()
	if p_node != null:
		p_node.add_child(aegis_node)
	elif get_tree() != null and get_tree().root != null:
		get_tree().root.add_child(aegis_node)
