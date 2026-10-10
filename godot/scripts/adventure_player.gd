class_name AdventurePlayer
extends CharacterBody3D

signal died
signal stats_changed
signal message(text: String)

const ProjectileScript = preload("res:/" + "/scripts/adventure_projectile.gd")
const WEAPONS: Array[String] = ["driftwood", "sword", "bow", "staff", "spear"]
var state: Node
var hp: float = 120.0
var max_hp: float = 120.0
var stamina: float = 100.0
var max_stamina: float = 100.0
var camera: Camera3D
var flasks: int = 3
var is_blocking: bool = false
var is_diving: bool = false
var is_dodging: bool = false
var is_guard_broken: bool = false
var is_attacking: bool = false
var mouse_sensitivity: float = 0.002
var controller_sensitivity: float = 2.5
var _dead: bool = false
var _dodge_time: float = 0.0
var _invulnerability_time: float = 0.0
var _dodge_direction: Vector3 = Vector3.ZERO
var _guard_time: float = 0.0
var _regen_delay: float = 0.0
var _attack_time: float = 0.0
var _attack_duration: float = 0.0
var _windup_time: float = 0.0
var _pending_attack: Dictionary = {}
var _stats_clock: float = 0.0
var _dive_y: float = 0.0
var _capture_dive_depth: bool = false
var _weapon_pivot: Node3D
var _shield_visual: Node3D
var _visual_key: String = ""

func configure(adventure_state: Node) -> void:
	state = adventure_state
	if state != null and not state.inventory_changed.is_connected(_on_inventory_changed):
		state.inventory_changed.connect(_on_inventory_changed)

func _ready() -> void:
	add_to_group("adventure_player")
	add_to_group("player")
	collision_layer = 4
	collision_mask = 3
	if state == null:
		configure(get_tree().root.get_node_or_null("Adventure"))
	_setup_inputs()
	var collision: CollisionShape3D = CollisionShape3D.new()
	var capsule: CapsuleShape3D = CapsuleShape3D.new()
	capsule.radius = 0.32
	capsule.height = 1.70
	collision.shape = capsule
	collision.position.y = 0.85
	add_child(collision)
	camera = Camera3D.new()
	camera.position.y = 1.52
	camera.fov = 80.0
	camera.near = 0.06
	camera.current = true
	add_child(camera)
	_weapon_pivot = Node3D.new()
	_weapon_pivot.position = Vector3(0.37, -0.32, -0.68)
	camera.add_child(_weapon_pivot)
	_shield_visual = Node3D.new()
	_shield_visual.position = Vector3(-0.40, -0.32, -0.64)
	camera.add_child(_shield_visual)
	_update_viewmodel()

func _setup_inputs() -> void:
	var bindings: Dictionary = {
		"adventure_forward": [KEY_W, KEY_UP], "adventure_back": [KEY_S, KEY_DOWN],
		"adventure_left": [KEY_A, KEY_LEFT], "adventure_right": [KEY_D, KEY_RIGHT],
		"adventure_dodge": [KEY_SPACE], "adventure_guard": [KEY_Q],
		"adventure_interact": [KEY_E], "adventure_heal": [KEY_F],
		"adventure_sprint": [KEY_SHIFT], "adventure_previous": [KEY_BRACKETLEFT],
		"adventure_next": [KEY_BRACKETRIGHT]
	}
	for action: String in bindings:
		if not InputMap.has_action(action):
			InputMap.add_action(action, 0.18)
		for key: int in bindings[action]:
			var event: InputEventKey = InputEventKey.new()
			event.physical_keycode = key
			if not InputMap.action_has_event(action, event):
				InputMap.action_add_event(action, event)
	_bind_mouse("adventure_light", MOUSE_BUTTON_LEFT)
	_bind_mouse("adventure_heavy", MOUSE_BUTTON_RIGHT)
	_bind_button("adventure_light", JOY_BUTTON_RIGHT_SHOULDER)
	_bind_button("adventure_heavy", JOY_BUTTON_Y)
	_bind_button("adventure_guard", JOY_BUTTON_LEFT_SHOULDER)
	_bind_button("adventure_dodge", JOY_BUTTON_B)
	_bind_button("adventure_interact", JOY_BUTTON_A)
	_bind_button("adventure_heal", JOY_BUTTON_X)
	_bind_button("adventure_previous", JOY_BUTTON_DPAD_LEFT)
	_bind_button("adventure_next", JOY_BUTTON_DPAD_RIGHT)
	_bind_button("adventure_sprint", JOY_BUTTON_LEFT_STICK)

func _bind_mouse(action: String, button: MouseButton) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	var event: InputEventMouseButton = InputEventMouseButton.new()
	event.button_index = button
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)

func _bind_button(action: String, button: JoyButton) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	var event: InputEventJoypadButton = InputEventJoypadButton.new()
	event.button_index = button
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)

func _unhandled_input(event: InputEvent) -> void:
	if _dead:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)
		camera.rotation.x = clampf(camera.rotation.x - event.relative.y * mouse_sensitivity, -1.35, 1.35)
	if event is InputEventKey and event.pressed and not event.echo and _attack_time <= 0.0 and state != null:
		if event.physical_keycode >= KEY_1 and event.physical_keycode <= KEY_5:
			state.equip_weapon(WEAPONS[event.physical_keycode - KEY_1])
	if event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _physics_process(delta: float) -> void:
	if _dead:
		velocity = Vector3.ZERO
		return
	if _capture_dive_depth:
		_dive_y = global_position.y
		_capture_dive_depth = false
	_advance_combat(delta)
	var look: Vector2 = Vector2(Input.get_joy_axis(0, JOY_AXIS_RIGHT_X), Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y))
	if look.length() > 0.18:
		rotate_y(-look.x * controller_sensitivity * delta)
		camera.rotation.x = clampf(camera.rotation.x - look.y * controller_sensitivity * delta, -1.35, 1.35)
	if state != null and _attack_time <= 0.0:
		if Input.is_action_just_pressed("adventure_previous"):
			state.cycle_weapon(-1)
		if Input.is_action_just_pressed("adventure_next"):
			state.cycle_weapon(1)
	is_blocking = state != null and state.has_item("buckler") and Input.is_action_pressed("adventure_guard") and not is_attacking and not is_dodging and not is_guard_broken
	if Input.is_action_just_pressed("adventure_dodge"):
		attempt_dodge()
	if Input.is_action_just_pressed("adventure_light"):
		attempt_attack(false)
	elif Input.is_action_just_pressed("adventure_heavy"):
		attempt_attack(true)
	if Input.is_action_just_pressed("adventure_interact"):
		interact()
	if Input.is_action_just_pressed("adventure_heal"):
		use_healing()
	var movement: Vector2 = Input.get_vector("adventure_left", "adventure_right", "adventure_forward", "adventure_back")
	var stick: Vector2 = Vector2(Input.get_joy_axis(0, JOY_AXIS_LEFT_X), Input.get_joy_axis(0, JOY_AXIS_LEFT_Y))
	if stick.length() > 0.18:
		movement = stick.limit_length()
	var direction: Vector3 = (transform.basis * Vector3(movement.x, 0.0, movement.y)).normalized()
	var speed: float = 4.8
	if is_diving:
		speed = 2.7 + (0.35 * maxi(0, state.tool_level("tide_charm") - 1) if state != null else 0.0)
	elif Input.is_action_pressed("adventure_sprint") and movement.length() > 0.1 and stamina > 0.0 and not is_blocking and not is_attacking:
		speed = 7.1
		stamina = maxf(0.0, stamina - 15.0 * delta)
		_regen_delay = 0.6
	if is_blocking:
		speed *= 0.65
	if is_guard_broken:
		speed *= 0.25
	if is_dodging:
		direction = _dodge_direction
		speed = 9.5
	velocity.x = direction.x * speed * movement.length() if not is_dodging else direction.x * speed
	velocity.z = direction.z * speed * movement.length() if not is_dodging else direction.z * speed
	if is_diving:
		velocity.y = 0.0
	else:
		velocity.y -= 18.0 * delta
	move_and_slide()
	if is_diving:
		global_position.y = _dive_y
	if _regen_delay <= 0.0 and not is_guard_broken:
		stamina = minf(max_stamina, stamina + delta * (12.0 if is_blocking else 27.0))
	_shield_visual.visible = state != null and state.has_item("buckler")
	_shield_visual.position.y = -0.18 if is_blocking else -0.36
	if is_attacking:
		var progress: float = 1.0 - _attack_time / maxf(0.01, _attack_duration)
		_weapon_pivot.rotation = Vector3(-0.35 * sin(progress * PI), 0.0, -0.85 * sin(progress * PI))
	else:
		_weapon_pivot.rotation = Vector3.ZERO
	_stats_clock += delta
	if _stats_clock >= 0.10:
		_stats_clock = 0.0
		stats_changed.emit()

func _advance_combat(delta: float) -> void:
	_regen_delay = maxf(0.0, _regen_delay - delta)
	_invulnerability_time = maxf(0.0, _invulnerability_time - delta)
	_dodge_time = maxf(0.0, _dodge_time - delta)
	_guard_time = maxf(0.0, _guard_time - delta)
	is_dodging = _dodge_time > 0.0
	is_guard_broken = _guard_time > 0.0
	if not _pending_attack.is_empty():
		_windup_time -= delta
		if _windup_time <= 0.0:
			var attack: Dictionary = _pending_attack
			_pending_attack = {}
			if attack["weapon"] in ["bow", "staff"]:
				_fire_projectile(attack)
			else:
				_perform_melee(attack)
	_attack_time = maxf(0.0, _attack_time - delta)
	is_attacking = _attack_time > 0.0

func attempt_attack(heavy: bool = false) -> bool:
	if state == null or _dead or is_guard_broken or is_dodging or is_blocking or _attack_time > 0.0:
		return false
	var weapon: String = state.equipped_weapon
	var definition: Dictionary = state.weapon_def(weapon)
	var cost: float = float(definition.get("heavy_stamina" if heavy else "stamina", 12.0))
	if stamina < cost:
		message.emit("Catch your breath.")
		return false
	if weapon in ["bow", "staff"]:
		if get_tree().get_nodes_in_group("adventure_projectile").size() >= 24:
			return false
		if not state.consume_ammo(weapon):
			message.emit("No arrows." if weapon == "bow" else "Staff empty. Rest at a checkpoint or buy charges.")
			return false
	stamina -= cost
	_regen_delay = 0.8
	_attack_duration = float(definition.get("heavy_cooldown" if heavy else "cooldown", 0.5))
	_attack_time = _attack_duration
	_windup_time = float(definition.get("heavy_windup" if heavy else "windup", 0.12))
	_pending_attack = {"weapon": weapon, "damage": float(definition.get("heavy_damage" if heavy else "damage", 18.0)), "reach": float(definition.get("reach", 2.25)), "speed": float(definition.get("speed", 25.0)), "stagger": 0.72 if heavy else 0.18, "heavy": heavy}
	is_attacking = true
	state.play_cue("spell" if weapon == "staff" else "swing")
	stats_changed.emit()
	return true

func _perform_melee(attack: Dictionary) -> void:
	if camera == null or not is_inside_tree():
		return
	var reach: float = float(attack["reach"])
	var origin: Vector3 = camera.global_position
	var forward: Vector3 = -camera.global_transform.basis.z
	var shape: SphereShape3D = SphereShape3D.new()
	shape.radius = reach * 0.58
	var query: PhysicsShapeQueryParameters3D = PhysicsShapeQueryParameters3D.new()
	query.shape = shape
	query.transform = Transform3D(Basis(), origin + forward * reach * 0.50)
	query.collision_mask = 10
	query.collide_with_areas = true
	query.exclude = [get_rid()]
	var hits: Array[Dictionary] = get_world_3d().direct_space_state.intersect_shape(query, 16)
	var touched: Dictionary = {}
	for result: Dictionary in hits:
		var target: Node3D = result.get("collider") as Node3D
		if target == null or touched.has(target.get_instance_id()):
			continue
		touched[target.get_instance_id()] = true
		var aim: Vector3 = target.global_position + Vector3.UP * 0.65
		var offset: Vector3 = aim - origin
		if offset.length() > reach + 0.45 or forward.dot(offset.normalized()) < 0.20:
			continue
		var ray: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(origin, aim, 11)
		ray.exclude = [get_rid()]
		ray.collide_with_areas = true
		var obstacle: Dictionary = get_world_3d().direct_space_state.intersect_ray(ray)
		if not obstacle.is_empty() and obstacle.get("collider") != target:
			continue
		if target.has_method("hit_weapon"):
			target.hit_weapon(str(attack["weapon"]))
		if target.has_method("take_damage"):
			target.take_damage(float(attack["damage"]), float(attack["stagger"]), global_position)

func _fire_projectile(attack: Dictionary) -> void:
	if get_tree().get_nodes_in_group("adventure_projectile").size() >= 24:
		state.add_ammo(str(attack["weapon"]), 1)
		return
	var projectile: Area3D = ProjectileScript.new()
	projectile.weapon_id = str(attack["weapon"])
	projectile.damage = float(attack["damage"])
	projectile.stagger = float(attack["stagger"])
	projectile.speed = float(attack["speed"])
	projectile.remaining_life = float(attack["reach"]) / maxf(projectile.speed, 0.01)
	projectile.direction = -camera.global_transform.basis.z
	projectile.owner_actor = self
	projectile.source_position = global_position
	projectile.blast_radius = (1.8 if bool(attack["heavy"]) else 1.3) if str(attack["weapon"]) == "staff" else 0.0
	get_tree().current_scene.add_child(projectile)
	projectile.global_position = camera.global_position

func dodge_stamina_cost() -> float:
	if state == null or not state.has_item("gale_mantle"):
		return 20.0
	return 20.0 - 4.0 * float(clampi(state.tool_level("gale_mantle"), 1, 3) - 1)

func attempt_dodge() -> bool:
	var cost: float = dodge_stamina_cost()
	if _dead or is_diving or is_dodging or is_guard_broken or is_attacking or stamina < cost:
		return false
	stamina -= cost
	_regen_delay = 0.9
	_dodge_time = 0.32
	_invulnerability_time = 0.22
	_dodge_direction = Vector3(velocity.x, 0.0, velocity.z).normalized()
	if _dodge_direction.length_squared() < 0.1:
		_dodge_direction = -transform.basis.z
	is_dodging = true
	return true

func take_damage(amount: float, source_position: Vector3 = Vector3.ZERO) -> void:
	if _dead or amount <= 0.0 or _invulnerability_time > 0.0:
		return
	var received: float = amount
	var toward_source: Vector3 = (source_position - global_position).normalized()
	var forward: Vector3 = -camera.global_transform.basis.z if camera != null else -global_transform.basis.z
	var facing: bool = source_position == Vector3.ZERO or forward.dot(toward_source) > 0.0
	if is_blocking and facing and state != null and state.has_item("buckler"):
		var level: int = state.tool_level("buckler")
		var cost: float = amount * (0.7 - 0.07 * (level - 1))
		if stamina >= cost:
			stamina -= cost
			state.play_cue("guard")
			received *= 1.0 - (0.65 + 0.10 * (level - 1))
		else:
			stamina = 0.0
			_guard_time = 0.65
			is_guard_broken = true
			is_blocking = false
		_regen_delay = 1.0
	hp = maxf(0.0, hp - received)
	if state != null:
		state.play_cue("hurt")
	stats_changed.emit()
	if hp <= 0.0:
		_dead = true
		_pending_attack = {}
		died.emit()

func heal_to_full() -> void:
	hp = max_hp
	stamina = max_stamina
	flasks = 3
	stats_changed.emit()

func use_healing() -> bool:
	if _dead or flasks <= 0 or hp >= max_hp or is_attacking:
		return false
	flasks -= 1
	hp = minf(max_hp, hp + 55.0)
	stats_changed.emit()
	return true

func set_diving(active: bool) -> void:
	is_diving = active
	_capture_dive_depth = active
	velocity.y = 0.0

func cancel_combat() -> void:
	is_blocking = false
	is_guard_broken = false
	is_dodging = false
	is_attacking = false
	_pending_attack = {}
	_attack_time = 0.0
	_windup_time = 0.0
	_guard_time = 0.0
	_dodge_time = 0.0
	_invulnerability_time = 0.0
	velocity = Vector3.ZERO

func checkpoint_respawn(position: Vector3) -> void:
	_dead = false
	cancel_combat()
	_invulnerability_time = 0.8
	set_diving(false)
	global_position = position
	velocity = Vector3.ZERO
	heal_to_full()

func _interaction_hit() -> Dictionary:
	if camera == null or not is_inside_tree():
		return {}
	var ray: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(camera.global_position, camera.global_position - camera.global_transform.basis.z * 3.4, 9)
	ray.exclude = [get_rid()]
	ray.collide_with_areas = true
	return get_world_3d().direct_space_state.intersect_ray(ray)

func get_interaction_prompt() -> String:
	var hit: Dictionary = _interaction_hit()
	var feature: Node = hit.get("collider") as Node
	if feature != null and feature.has_method("prompt") and feature.has_method("interact"):
		return str(feature.prompt())
	return ""

func interact() -> void:
	if _dead:
		return
	var hit: Dictionary = _interaction_hit()
	var feature: Node = hit.get("collider") as Node
	if feature != null and feature.has_method("interact"):
		feature.interact(self)

func _on_inventory_changed() -> void:
	if is_inside_tree() and _weapon_pivot != null:
		_update_viewmodel()

func _part(parent: Node3D, mesh: Mesh, position: Vector3, color: Color, rotation: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var visual: MeshInstance3D = MeshInstance3D.new()
	visual.mesh = mesh
	visual.position = position
	visual.rotation = rotation
	visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = color
	visual.material_override = material
	parent.add_child(visual)
	return visual

func _update_viewmodel() -> void:
	var weapon: String = str(state.equipped_weapon) if state != null else "driftwood"
	var level: int = state.tool_level(weapon) if state != null else 1
	var shield_level: int = state.tool_level("buckler") if state != null else 0
	var key: String = weapon + str(level) + str(shield_level)
	if key == _visual_key:
		return
	_visual_key = key
	for child: Node in _weapon_pivot.get_children():
		child.queue_free()
	for child: Node in _shield_visual.get_children():
		child.queue_free()
	var wood: Color = Color(0.34, 0.19, 0.08)
	var steel: Color = Color(0.65, 0.76, 0.81)
	var shaft: CylinderMesh = CylinderMesh.new()
	shaft.top_radius = 0.045 if weapon == "driftwood" else 0.025
	shaft.bottom_radius = 0.065 if weapon == "driftwood" else 0.030
	shaft.height = 0.68 if weapon == "driftwood" else 0.85
	shaft.radial_segments = 6
	_part(_weapon_pivot, shaft, Vector3(0.0, 0.15, 0.0), wood, Vector3(0.35, 0.0, -0.2))
	if weapon == "sword":
		var blade: BoxMesh = BoxMesh.new()
		blade.size = Vector3(0.13, 0.67, 0.035)
		_part(_weapon_pivot, blade, Vector3(0.0, 0.53, -0.15), steel, Vector3(0.35, 0.0, -0.2))
		var guard: BoxMesh = BoxMesh.new()
		guard.size = Vector3(0.34, 0.045, 0.06)
		_part(_weapon_pivot, guard, Vector3(0.0, 0.19, -0.02), Color(0.58, 0.45, 0.17))
	elif weapon == "spear":
		var tip: PrismMesh = PrismMesh.new()
		tip.size = Vector3(0.16, 0.32, 0.08)
		_part(_weapon_pivot, tip, Vector3(0.0, 0.72, -0.24), steel, Vector3(0.35, 0.0, -0.2))
	elif weapon == "staff":
		var crystal: SphereMesh = SphereMesh.new()
		crystal.radius = 0.11
		crystal.height = 0.22
		crystal.radial_segments = 8
		crystal.rings = 4
		_part(_weapon_pivot, crystal, Vector3(0.0, 0.64, -0.20), Color(1.0, 0.31, 0.06))
	elif weapon == "bow":
		var string_mesh: BoxMesh = BoxMesh.new()
		string_mesh.size = Vector3(0.016, 0.81, 0.016)
		_part(_weapon_pivot, string_mesh, Vector3(-0.11, 0.14, 0.0), Color(0.8, 0.75, 0.55))
		for sign_value: float in [-1.0, 1.0]:
			var limb: BoxMesh = BoxMesh.new()
			limb.size = Vector3(0.045, 0.44, 0.055)
			_part(_weapon_pivot, limb, Vector3(-0.03, 0.14 + sign_value * 0.20, 0.0), wood, Vector3(0.0, 0.0, -sign_value * 0.38))
	if shield_level > 0:
		var shield: CylinderMesh = CylinderMesh.new()
		shield.top_radius = 0.22
		shield.bottom_radius = 0.22
		shield.height = 0.045
		shield.radial_segments = 10
		_part(_shield_visual, shield, Vector3.ZERO, Color(0.42, 0.34, 0.18), Vector3(PI * 0.5, 0.0, 0.0))
