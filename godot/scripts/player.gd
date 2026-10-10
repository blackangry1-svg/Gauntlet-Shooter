class_name SoulsPlayer
extends CharacterBody3D

signal stats_changed(hp: float, max_hp: float, stamina: float, max_stamina: float, mana: float, max_mana: float)
signal weapon_switched(weapon_name: String, is_primary: bool)
signal estus_used(remaining: int)
signal guard_broken()

var HeroClassesScript = load("res:/" + "/scripts/hero_classes.gd")
var ProjectileScript = load("res:/" + "/scripts/projectile.gd")
var AudioSynthScript = load("res:/" + "/scripts/audio_synth.gd")

@export var mouse_sensitivity: float = 0.002
@export var controller_look_sensitivity: float = 2.8
@export var controller_deadzone: float = 0.15

var class_data: Dictionary
var current_hp: float = 150.0
var max_hp: float = 150.0
var current_stamina: float = 100.0
var max_stamina: float = 100.0
var current_mana: float = 20.0
var max_mana: float = 20.0
var estus_charges: int = 3
var max_estus: int = 3

var is_primary_weapon: bool = true
var is_blocking: bool = false
var is_dodging: bool = false
var is_sprinting: bool = false
var is_sprint_exhausted: bool = false
var _sprint_stick_active: bool = false
var is_invulnerable: bool = false
var is_attacking: bool = false
var is_guard_broken: bool = false
var has_aegis_shield: bool = false

var _dodge_timer: float = 0.0
var _iframe_timer: float = 0.0
var _attack_timer: float = 0.0
var _guard_break_timer: float = 0.0
var _stamina_regen_delay: float = 0.0
var _dodge_dir: Vector3 = Vector3.FORWARD

var camera: Camera3D
var weapon_pivot: Node3D
var weapon_mesh: MeshInstance3D
var shield_mesh: MeshInstance3D
var _audio_synth: Node

func _ready() -> void:
	add_to_group("player")
	_setup_camera_and_viewmodels()
	
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton and global_singleton.audio_synth != null:
		_audio_synth = global_singleton.audio_synth
	else:
		_audio_synth = AudioSynthScript.new()
		add_child(_audio_synth)
	
	if global_singleton:
		global_singleton.hero_class_changed.connect(_on_hero_class_changed)
		global_singleton.aegis_acquired.connect(_on_aegis_acquired)
		if global_singleton.has_aegis_of_minotaur:
			has_aegis_shield = true
		apply_hero_class(int(global_singleton.current_hero_class))
	else:
		apply_hero_class(0)

func _setup_camera_and_viewmodels() -> void:
	camera = Camera3D.new()
	camera.position = Vector3(0, 1.65, 0)
	camera.current = true
	add_child(camera)
	
	weapon_pivot = Node3D.new()
	weapon_pivot.position = Vector3(0.4, -0.35, -0.6)
	camera.add_child(weapon_pivot)
	
	weapon_mesh = MeshInstance3D.new()
	weapon_pivot.add_child(weapon_mesh)
	
	shield_mesh = MeshInstance3D.new()
	shield_mesh.position = Vector3(-0.4, -0.35, -0.5)
	shield_mesh.visible = false
	camera.add_child(shield_mesh)
	
	var col = CollisionShape3D.new()
	var cap = CapsuleShape3D.new()
	cap.radius = 0.45
	cap.height = 1.8
	col.shape = cap
	col.position.y = 0.9
	add_child(col)

func apply_hero_class(hero_enum: int) -> void:
	class_data = HeroClassesScript.get_class_data(hero_enum)
	max_hp = class_data["max_hp"]
	current_hp = max_hp
	max_stamina = class_data["max_stamina"]
	current_stamina = max_stamina
	max_mana = class_data["max_mana"]
	current_mana = max_mana
	is_primary_weapon = true
	_update_viewmodel_visuals()
	_emit_stats()

func _on_hero_class_changed(new_class: int) -> void:
	apply_hero_class(new_class)

func _on_aegis_acquired() -> void:
	has_aegis_shield = true
	_update_viewmodel_visuals()

func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)
		camera.rotate_x(-event.relative.y * mouse_sensitivity)
		camera.rotation.x = clamp(camera.rotation.x, -deg_to_rad(85), deg_to_rad(85))

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= 19.6 * delta
		
	_process_timers(delta)
	_process_controller_look(delta)
	_process_inputs(delta)
	_process_regen(delta)
	
	move_and_slide()
	_emit_stats()

func _process_controller_look(delta: float) -> void:
	var joy_rx = Input.get_joy_axis(0, JOY_AXIS_RIGHT_X)
	var joy_ry = Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y)
	
	if abs(joy_rx) > controller_deadzone:
		rotate_y(-joy_rx * controller_look_sensitivity * delta)
	if abs(joy_ry) > controller_deadzone:
		camera.rotate_x(-joy_ry * controller_look_sensitivity * delta)
		camera.rotation.x = clamp(camera.rotation.x, -deg_to_rad(85), deg_to_rad(85))

func _process_inputs(delta: float) -> void:
	if is_guard_broken:
		velocity.x = 0.0
		velocity.z = 0.0
		return
		
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton:
		if Input.is_action_just_pressed("cycle_class_next"):
			var cur = int(global_singleton.current_hero_class)
			var nxt = (cur + 1) % 4
			global_singleton.select_hero(nxt)
			return
		elif Input.is_action_just_pressed("cycle_class_prev"):
			var cur = int(global_singleton.current_hero_class)
			var prev = (cur + 3) % 4
			global_singleton.select_hero(prev)
			return

	if Input.is_action_just_pressed("dodge") and not is_dodging and current_stamina >= 20.0:
		_execute_dodge()
		return
		
	if Input.is_action_just_pressed("switch_weapon"):
		is_primary_weapon = not is_primary_weapon
		_update_viewmodel_visuals()
		var w_name = class_data["primary_weapon"]["name"] if is_primary_weapon else class_data["secondary_weapon"]["name"]
		if not is_primary_weapon and has_aegis_shield:
			w_name = "Aegis of the Minotaur"
		weapon_switched.emit(w_name, is_primary_weapon)
		
	is_blocking = Input.is_action_pressed("block") and not is_attacking and not is_dodging
	shield_mesh.visible = is_blocking
	
	if Input.is_action_just_pressed("attack_light") and not is_attacking and not is_dodging and not is_blocking:
		_execute_attack(false)
		
	if Input.is_action_just_pressed("attack_heavy") and not is_attacking and not is_dodging and not is_blocking:
		_execute_attack(true)
		
	if Input.is_action_just_pressed("heal"):
		_use_estus()
		
	if not is_dodging:
		var input_dir = Vector2.ZERO
		if Input.is_action_pressed("move_forward"): input_dir.y -= 1.0
		if Input.is_action_pressed("move_back"): input_dir.y += 1.0
		if Input.is_action_pressed("move_left"): input_dir.x -= 1.0
		if Input.is_action_pressed("move_right"): input_dir.x += 1.0
		
		var joy_lx = Input.get_joy_axis(0, JOY_AXIS_LEFT_X)
		var joy_ly = Input.get_joy_axis(0, JOY_AXIS_LEFT_Y)
		if Vector2(joy_lx, joy_ly).length() > controller_deadzone:
			input_dir = Vector2(joy_lx, joy_ly)
			
		input_dir = input_dir.normalized()
		var move_speed = class_data.get("speed", 5.0)
		
		# Sprint management: continuous drain, cannot sprint on empty stamina, auto-drop to walk speed
		if Input.is_action_just_pressed("sprint"):
			if is_sprinting:
				is_sprinting = false
				_sprint_stick_active = false
			elif input_dir.length() > 0.1 and current_stamina > 10.0 and not is_sprint_exhausted:
				is_sprinting = true
				if Input.is_joy_button_pressed(0, JOY_BUTTON_LEFT_STICK):
					_sprint_stick_active = true
		elif Input.is_action_pressed("sprint"):
			if input_dir.length() > 0.1 and current_stamina > 10.0 and not is_sprint_exhausted:
				is_sprinting = true
		elif Input.is_action_just_released("sprint"):
			if not _sprint_stick_active:
				is_sprinting = false
				
		if input_dir.length() < 0.1:
			is_sprinting = false
			_sprint_stick_active = false

		if is_sprinting:
			if current_stamina > 0.0:
				move_speed = class_data.get("sprint_speed", 7.5)
				var sprint_drain = 20.0 # Standard Souls sprint stamina drain rate (20/sec)
				current_stamina = max(0.0, current_stamina - sprint_drain * delta)
				_stamina_regen_delay = 1.2
				if current_stamina <= 0.0:
					current_stamina = 0.0
					is_sprinting = false
					is_sprint_exhausted = true
					_sprint_stick_active = false
					move_speed = class_data.get("speed", 5.0)
			else:
				is_sprinting = false
				is_sprint_exhausted = true
				_sprint_stick_active = false
				move_speed = class_data.get("speed", 5.0)
				
		if is_sprint_exhausted and current_stamina >= 20.0:
			is_sprint_exhausted = false
			
		var forward = -transform.basis.z
		var right = transform.basis.x
		var move_vec = (right * input_dir.x + forward * -input_dir.y).normalized()
		
		velocity.x = move_vec.x * move_speed
		velocity.z = move_vec.z * move_speed
	else:
		var d_speed = class_data.get("dodge_speed", 10.0)
		velocity.x = _dodge_dir.x * d_speed
		velocity.z = _dodge_dir.z * d_speed

func _execute_dodge() -> void:
	var forward = -transform.basis.z
	var right = transform.basis.x
	var input_dir = Vector2.ZERO
	if Input.is_action_pressed("move_forward"): input_dir.y -= 1.0
	if Input.is_action_pressed("move_back"): input_dir.y += 1.0
	if Input.is_action_pressed("move_left"): input_dir.x -= 1.0
	if Input.is_action_pressed("move_right"): input_dir.x += 1.0
	
	var joy_lx = Input.get_joy_axis(0, JOY_AXIS_LEFT_X)
	var joy_ly = Input.get_joy_axis(0, JOY_AXIS_LEFT_Y)
	if Vector2(joy_lx, joy_ly).length() > controller_deadzone:
		input_dir = Vector2(joy_lx, joy_ly)
	
	if input_dir.length() > 0.1:
		_dodge_dir = (right * input_dir.x + forward * -input_dir.y).normalized()
	elif Vector2(velocity.x, velocity.z).length() > 0.5:
		_dodge_dir = Vector3(velocity.x, 0, velocity.z).normalized()
	else:
		_dodge_dir = -forward
		
	current_stamina = max(0.0, current_stamina - 22.0)
	_stamina_regen_delay = 1.2
	is_dodging = true
	is_invulnerable = true
	_dodge_timer = class_data.get("dodge_duration", 0.35)
	_iframe_timer = class_data.get("dodge_iframes", 0.28)
	if _audio_synth and _audio_synth.swing_wav:
		_audio_synth.play_sfx_2d(_audio_synth.swing_wav, -2.0)

func _execute_attack(is_heavy: bool) -> void:
	var wep = class_data["primary_weapon"] if is_primary_weapon else class_data["secondary_weapon"]
	var stam_cost = wep.get("stamina_cost_heavy" if is_heavy else "stamina_cost_light", 15.0)
	var mana_cost = wep.get("mana_cost_heavy" if is_heavy else "mana_cost_light", wep.get("mana_cost", 0.0))
	
	if current_stamina < stam_cost or current_mana < mana_cost:
		return
		
	current_stamina -= stam_cost
	current_mana -= mana_cost
	_stamina_regen_delay = 1.2
	
	is_attacking = true
	_attack_timer = wep.get("cooldown_heavy" if is_heavy else "cooldown_light", 0.5)
	
	var w_type = wep.get("type", 0)
	if w_type == 3 or w_type == 4:
		_shoot_hero_projectile(wep, is_heavy)
	else:
		_perform_melee_swing(wep, is_heavy)

func _perform_melee_swing(wep: Dictionary, is_heavy: bool) -> void:
	if _audio_synth and _audio_synth.swing_wav:
		_audio_synth.play_sfx_2d(_audio_synth.swing_wav, 0.0)
	var reach = wep.get("range", 2.8)
	var dmg = wep.get("damage_heavy" if is_heavy else "damage_light", 35.0)
	var stag = wep.get("heavy_stagger_duration" if is_heavy else "stagger_duration", 0.85 if is_heavy else 0.4)
	
	var space = get_world_3d().direct_space_state
	var from_pos = camera.global_position
	var to_pos = from_pos + (-camera.global_transform.basis.z * reach)
	var ray_query = PhysicsRayQueryParameters3D.create(from_pos, to_pos)
	ray_query.exclude = [self]
	var hit = space.intersect_ray(ray_query)
	
	var hit_detected = false
	if hit:
		var collider = hit.get("collider")
		if collider and collider.has_method("take_damage"):
			collider.take_damage(dmg, stag, -camera.global_transform.basis.z)
			hit_detected = true
	
	if not hit_detected:
		var shape_query = PhysicsShapeQueryParameters3D.new()
		var sphere = SphereShape3D.new()
		sphere.radius = 0.65
		shape_query.shape = sphere
		shape_query.transform = Transform3D(Basis(), from_pos + (-camera.global_transform.basis.z * (reach * 0.7)))
		shape_query.exclude = [self]
		var hits = space.intersect_shape(shape_query, 8)
		for h in hits:
			var c = h.get("collider")
			if c and c.has_method("take_damage"):
				c.take_damage(dmg, stag, -camera.global_transform.basis.z)
				hit_detected = true
				if not is_heavy:
					break

	if hit_detected:
		if _audio_synth and _audio_synth.impact_wav:
			_audio_synth.play_sfx_2d(_audio_synth.impact_wav, 2.0)
		_rumble(0.4 if is_heavy else 0.2, 0.6 if is_heavy else 0.3, 0.18)

func _shoot_hero_projectile(wep: Dictionary, is_heavy: bool) -> void:
	var is_magic = (wep.get("type") == 4)
	if _audio_synth:
		_audio_synth.play_sfx_2d(_audio_synth.spell_wav if is_magic else _audio_synth.swing_wav, 2.0)
	
	var proj = ProjectileScript.new()
	proj.damage = wep.get("damage_heavy" if is_heavy else "damage_light", 45.0)
	proj.speed = wep.get("projectile_speed", 25.0)
	proj.blast_radius = wep.get("blast_radius", 3.5) if is_magic else 0.0
	proj.direction = -camera.global_transform.basis.z
	proj.stagger_duration = wep.get("heavy_stagger_duration" if is_heavy else "stagger_duration", 0.8 if is_heavy else 0.4)
	proj.source_node = self
	proj.position = camera.global_position + (-camera.global_transform.basis.z * 0.8)
	
	var parent_node = get_parent()
	if parent_node != null:
		parent_node.add_child(proj)
	elif get_tree() != null and get_tree().root != null:
		get_tree().root.add_child(proj)

func _use_estus() -> void:
	if estus_charges > 0 and current_hp < max_hp:
		estus_charges -= 1
		current_hp = min(max_hp, current_hp + 60.0)
		if _audio_synth and _audio_synth.spell_wav:
			_audio_synth.play_sfx_2d(_audio_synth.spell_wav, -2.0)
		estus_used.emit(estus_charges)

func rest_at_bonfire() -> void:
	current_hp = max_hp
	current_stamina = max_stamina
	current_mana = max_mana
	estus_charges = max_estus
	is_guard_broken = false
	_guard_break_timer = 0.0
	_emit_stats()

func heal_continuous(amount: float) -> void:
	current_hp = min(max_hp, current_hp + amount)
	current_stamina = min(max_stamina, current_stamina + amount)
	current_mana = min(max_mana, current_mana + amount)
	_emit_stats()

func take_damage(amount: float, stagger_dur: float = 0.4, impact_dir: Vector3 = Vector3.ZERO) -> void:
	if is_invulnerable:
		return
		
	if is_blocking:
		var sec_wep = class_data.get("secondary_weapon", {})
		var absorb = 0.95 if has_aegis_shield else sec_wep.get("block_absorption", 0.75)
		var mult = 0.5 if has_aegis_shield else sec_wep.get("block_stamina_drain_multiplier", 1.0)
		var stamina_loss = amount * mult
		
		# Arcane Ward mana drain handling
		var mana_loss = sec_wep.get("mana_drain_per_hit", 0.0)
		if mana_loss > 0.0:
			current_mana = max(0.0, current_mana - mana_loss)
		
		if current_stamina >= stamina_loss:
			current_stamina -= stamina_loss
			current_hp -= amount * (1.0 - absorb)
			_stamina_regen_delay = 1.5
			if _audio_synth and _audio_synth.block_wav:
				_audio_synth.play_sfx_2d(_audio_synth.block_wav, 2.0)
			_rumble(0.3, 0.5, 0.15)
			_emit_stats()
			return
		else:
			# GUARD BREAK!
			current_stamina = 0.0
			is_guard_broken = true
			_guard_break_timer = 1.1
			is_blocking = false
			shield_mesh.visible = false
			# Unblocked posture break damage penetrates
			current_hp -= amount * (1.0 - (absorb * 0.4))
			guard_broken.emit()
			if _audio_synth and _audio_synth.block_wav:
				_audio_synth.play_sfx_2d(_audio_synth.block_wav, 6.0)
			_rumble(1.0, 1.0, 0.55)
			_emit_stats()
			if current_hp <= 0.0:
				_die()
			return
				
	current_hp -= amount
	if _audio_synth and _audio_synth.impact_wav:
		_audio_synth.play_sfx_2d(_audio_synth.impact_wav, 3.0)
	_rumble(0.6, 0.8, 0.3)
	_emit_stats()
	
	if current_hp <= 0.0:
		_die()

func _rumble(weak: float, strong: float, duration: float) -> void:
	Input.start_joy_vibration(0, weak, strong, duration)

func _die() -> void:
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton:
		global_singleton.player_died.emit()

func _process_timers(delta: float) -> void:
	if is_dodging:
		_dodge_timer -= delta
		if _dodge_timer <= 0.0:
			is_dodging = false
			
	if is_invulnerable:
		_iframe_timer -= delta
		if _iframe_timer <= 0.0:
			is_invulnerable = false
			
	if is_attacking:
		_attack_timer -= delta
		if _attack_timer <= 0.0:
			is_attacking = false
			
	if is_guard_broken:
		_guard_break_timer -= delta
		if _guard_break_timer <= 0.0:
			is_guard_broken = false

func _process_regen(delta: float) -> void:
	_stamina_regen_delay = max(0.0, _stamina_regen_delay - delta)
	if _stamina_regen_delay <= 0.0 and not is_guard_broken and not is_sprinting:
		var s_rate = class_data.get("stamina_regen", 30.0)
		current_stamina = min(max_stamina, current_stamina + s_rate * delta)
		
	var m_rate = class_data.get("mana_regen", 5.0)
	current_mana = min(max_mana, current_mana + m_rate * delta)

func _update_viewmodel_visuals() -> void:
	var wep = class_data["primary_weapon"] if is_primary_weapon else class_data["secondary_weapon"]
	var w_type = wep.get("type", 0)
	
	var mat = StandardMaterial3D.new()
	match w_type:
		0:
			var box = BoxMesh.new()
			box.size = Vector3(0.1, 0.85, 0.15)
			weapon_mesh.mesh = box
			mat.albedo_color = Color(0.7, 0.75, 0.8)
			mat.metallic = 0.9
		1:
			var cyl = CylinderMesh.new()
			cyl.top_radius = 0.04
			cyl.bottom_radius = 0.04
			cyl.height = 1.6
			weapon_mesh.mesh = cyl
			mat.albedo_color = Color(0.85, 0.75, 0.3)
		2:
			var box = BoxMesh.new()
			box.size = Vector3(0.06, 0.45, 0.08)
			weapon_mesh.mesh = box
			mat.albedo_color = Color(0.3, 0.8, 0.5)
		3:
			var box = BoxMesh.new()
			box.size = Vector3(0.08, 0.95, 0.25)
			weapon_mesh.mesh = box
			mat.albedo_color = Color(0.55, 0.35, 0.2)
		4:
			var cyl = CylinderMesh.new()
			cyl.top_radius = 0.06
			cyl.bottom_radius = 0.06
			cyl.height = 1.3
			weapon_mesh.mesh = cyl
			mat.albedo_color = Color(0.2, 0.5, 0.9)
			mat.emission_enabled = true
			mat.emission = Color(0.3, 0.6, 1.0)
		5, 6:
			var box = BoxMesh.new()
			box.size = Vector3(0.65, 0.8, 0.1)
			weapon_mesh.mesh = box
			if has_aegis_shield:
				mat.albedo_color = Color(1.0, 0.84, 0.1)
				mat.metallic = 0.95
				mat.emission_enabled = true
				mat.emission = Color(0.9, 0.7, 0.2)
				mat.emission_energy_multiplier = 2.0
			else:
				mat.albedo_color = Color(0.85, 0.7, 0.2)
	
	weapon_mesh.material_override = mat

func _emit_stats() -> void:
	stats_changed.emit(current_hp, max_hp, current_stamina, max_stamina, current_mana, max_mana)
