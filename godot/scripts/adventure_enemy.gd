class_name AdventureEnemy
extends CharacterBody3D

signal defeated(enemy)
enum Phase { SLEEP, CHASE, WINDUP, ACTIVE, RECOVERY, STAGGER, DEAD }

var director: Node
var profile: Dictionary = {}
var max_hp: float = 70.0
var hp: float = 70.0
var phase: Phase = Phase.SLEEP
var is_boss: bool = false
var floor_index: int = 0
var awake: bool = false
var _revealed: bool = true
var _timer: float = 0.0
var _cooldown: float = 0.5
var _attack: Dictionary = {}
var _aim: Vector3 = Vector3.FORWARD
var _waypoint: Vector3 = Vector3.ZERO
var _hit: bool = false
var _posture: float = 0.0
var _burst_timer: float = 0.0
var _bursts_left: int = 0
var _visual: Node3D
var _cue: MeshInstance3D
var _shape: CollisionShape3D
var _clock: float = 0.0

func configure(owner_director: Node, data: Dictionary, stage: int = 0) -> void:
	director = owner_director
	profile = data.duplicate(true)
	floor_index = stage
	is_boss = bool(profile.get("boss", false))
	max_hp = float(profile.get("hp", 70.0))
	hp = max_hp

func _ready() -> void:
	add_to_group("adventure_enemy")
	collision_layer = 2
	collision_mask = 1
	_shape = CollisionShape3D.new()
	var capsule = CapsuleShape3D.new()
	capsule.radius = 0.8 if is_boss else float(profile.get("radius", 0.38))
	capsule.height = 2.7 if is_boss else float(profile.get("collision_height", 1.65))
	_shape.shape = capsule
	_shape.position.y = capsule.height * 0.5
	add_child(_shape)
	_visual = Node3D.new()
	add_child(_visual)
	build_visuals()
	_build_cue()
	set_revealed(not bool(profile.get("hidden", false)))
	set_awake(false)

func build_visuals() -> void:
	if _build_creature_silhouette():
		return
	var tint: Color = profile.get("color", Color(0.4, 0.45, 0.3))
	var scale_height: float = float(profile.get("height", 1.8))
	var texture_path: String = str(profile.get("texture", ""))
	if not texture_path.is_empty() and ResourceLoader.exists(texture_path):
		var sprite = Sprite3D.new()
		var atlas = AtlasTexture.new()
		atlas.atlas = load(texture_path)
		atlas.region = Rect2(0, 0, 256, 256)
		sprite.texture = atlas
		sprite.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
		sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
		sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
		sprite.shaded = false
		sprite.pixel_size = scale_height / 230.0
		sprite.position.y = scale_height * 0.52
		sprite.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_visual.add_child(sprite)
	else:
		add_box(Vector3(0.62, scale_height * 0.55, 0.45), Vector3(0, scale_height * 0.53, 0), tint)
		add_sphere(0.25, Vector3(0, scale_height * 0.88, 0), tint.lightened(0.18))
		for side in [-1.0, 1.0]:
			add_box(Vector3(0.18, 0.65, 0.22), Vector3(side * 0.18, 0.34, 0), tint.darkened(0.18))
		var kind: String = str(profile.get("pattern", "melee"))
		if kind == "ranged":
			add_box(Vector3(0.09, 1.4, 0.09), Vector3(-0.44, 0.9, 0), Color(0.5, 0.33, 0.18))
			add_sphere(0.17, Vector3(-0.44, 1.68, 0), Color(0.8, 0.65, 0.3))
		elif kind == "guard":
			add_box(Vector3(0.52, 0.86, 0.1), Vector3(0.43, 0.9, -0.28), tint.darkened(0.35))
			add_box(Vector3(0.09, 0.85, 0.13), Vector3(-0.43, 1.0, -0.08), Color(0.7, 0.68, 0.58))
		else:
			add_box(Vector3(0.12, 1.05, 0.12), Vector3(-0.45, 1.0, -0.05), Color(0.58, 0.46, 0.28))

func _build_creature_silhouette() -> bool:
	var id: String = str(profile.get("id", ""))
	var color: Color = profile.get("color", Color.GRAY)
	var metal = Color(0.6, 0.59, 0.53)
	if id == "cave_spider":
		add_sphere(0.42, Vector3(0, 0.58, 0.28), Color(0.3, 0.19, 0.13))
		add_sphere(0.3, Vector3(0, 0.48, -0.32), Color(0.2, 0.15, 0.1))
		for side in [-1.0, 1.0]:
			for i in range(4):
				var leg = add_box(Vector3(0.75, 0.1, 0.1), Vector3(side * 0.53, 0.35, -0.5 + float(i) * 0.31), Color(0.44, 0.31, 0.16))
				leg.rotation.y = side * (float(i) - 1.5) * 0.3
				leg.rotation.z = side * -0.3
			add_box(Vector3(0.07, 0.18, 0.08), Vector3(side * 0.1, 0.34, -0.62), Color(0.9, 0.77, 0.55))
		return true
	if id == "ember_imp":
		add_sphere(0.28, Vector3(0, 0.55, 0), Color(0.28, 0.13, 0.09))
		add_sphere(0.23, Vector3(0, 1.0, 0), Color(0.5, 0.22, 0.12))
		for side in [-1.0, 1.0]:
			var horn = add_box(Vector3(0.07, 0.3, 0.08), Vector3(side * 0.16, 1.3, 0), Color(0.6, 0.45, 0.28))
			horn.rotation.z = side * -0.3
			add_box(Vector3(0.14, 0.32, 0.15), Vector3(side * 0.18, 0.2, 0), Color(0.28, 0.13, 0.09))
		add_sphere(0.18, Vector3(0.35, 0.64, -0.12), Color(0.5, 0.27, 0.14))
		add_sphere(0.08, Vector3(0.35, 0.88, -0.12), Color(1.0, 0.42, 0.08))
		return true
	if id in ["mire_hag", "frost_wraith", "ash_zealot"]:
		var robe = CylinderMesh.new()
		robe.top_radius = 0.18
		robe.bottom_radius = 0.5
		robe.height = 1.4 if id != "frost_wraith" else 1.8
		robe.radial_segments = 6
		add_mesh(robe, Vector3(0, robe.height * 0.5, 0), color)
		add_sphere(0.23, Vector3(0, robe.height + 0.2, -0.08), color.lightened(0.3))
		if id == "frost_wraith":
			add_box(Vector3(0.09, 2.1, 0.09), Vector3(-0.35, 1.1, -0.25), Color(0.37, 0.54, 0.67))
			var blade = add_box(Vector3(0.95, 0.12, 0.15), Vector3(-0.06, 2.15, -0.25), Color(0.69, 0.86, 0.96))
			blade.rotation.z = -0.22
		elif id == "mire_hag":
			add_box(Vector3(0.09, 1.9, 0.09), Vector3(-0.5, 0.95, -0.15), Color(0.43, 0.31, 0.18))
			add_sphere(0.14, Vector3(-0.5, 1.95, -0.15), Color(0.77, 0.69, 0.26))
			add_box(Vector3(0.05, 0.4, 0.05), Vector3(0.48, 0.92, -0.2), metal)
			add_sphere(0.17, Vector3(0.48, 0.62, -0.2), Color(0.64, 0.45, 0.23))
		else:
			add_sphere(0.15, Vector3(-0.5, 0.7, -0.27), metal)
			add_box(Vector3(0.06, 0.35, 0.06), Vector3(-0.5, 1.0, -0.27), metal)
		return true
	if id in ["barrow_knight", "mirror_duelist", "rune_sentinel", "moss_troll"]:
		var height: float = 2.25 if id in ["rune_sentinel", "moss_troll"] else 1.8
		add_box(Vector3(0.9 if height > 2.0 else 0.62, height * 0.48, 0.5), Vector3(0, height * 0.58, 0), color)
		add_sphere(0.3 if height > 2.0 else 0.23, Vector3(0, height * 0.9, 0), color.lightened(0.2))
		for side in [-1.0, 1.0]:
			add_box(Vector3(0.23, height * 0.42, 0.26), Vector3(side * 0.22, height * 0.22, 0), color.darkened(0.2))
		if id == "barrow_knight":
			add_box(Vector3(0.17, 1.8, 0.11), Vector3(0, 1.18, -0.48), metal)
			add_box(Vector3(0.52, 0.09, 0.16), Vector3(0, 0.68, -0.48), metal.darkened(0.25))
			for side in [-1.0, 1.0]:
				add_sphere(0.12, Vector3(side * 0.16, 0.88, -0.49), color)
		elif id == "rune_sentinel":
			add_box(Vector3(0.65, 1.0, 0.13), Vector3(0.56, 1.15, -0.23), color.darkened(0.3))
			add_box(Vector3(0.09, 0.8, 0.1), Vector3(-0.52, 1.2, -0.1), Color(0.42, 0.29, 0.15))
			add_box(Vector3(0.42, 0.3, 0.32), Vector3(-0.52, 1.7, -0.1), metal)
			add_box(Vector3(0.18, 0.4, 0.18), Vector3(0, 2.45, 0), Color(0.7, 0.41, 0.86))
		elif id == "moss_troll":
			var log = add_box(Vector3(0.25, 1.5, 0.3), Vector3(0.55, 1.35, -0.2), Color(0.36, 0.24, 0.12))
			log.rotation.z = -0.35
			add_box(Vector3(0.85, 0.15, 0.5), Vector3(0, 2.4, 0), Color(0.3, 0.35, 0.17))
			add_sphere(0.13, Vector3(0.5, 1.12, -0.22), color)
		else:
			var rapier = add_box(Vector3(0.045, 1.2, 0.06), Vector3(0.48, 1.15, -0.2), metal)
			rapier.rotation.z = 0.45
			add_box(Vector3(0.22, 0.25, 0.07), Vector3(0, 1.68, -0.21), metal.lightened(0.3))
		return true
	return false

func add_box(size: Vector3, position_value: Vector3, color: Color) -> MeshInstance3D:
	var mesh = BoxMesh.new()
	mesh.size = size
	return add_mesh(mesh, position_value, color)

func add_sphere(radius: float, position_value: Vector3, color: Color) -> MeshInstance3D:
	var mesh = SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 8
	mesh.rings = 4
	return add_mesh(mesh, position_value, color)

func add_mesh(mesh: Mesh, position_value: Vector3, color: Color) -> MeshInstance3D:
	var instance = MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = position_value
	instance.material_override = director.material_for(color)
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_visual.add_child(instance)
	return instance

func _build_cue() -> void:
	_cue = MeshInstance3D.new()
	var ring = CylinderMesh.new()
	ring.top_radius = 0.7
	ring.bottom_radius = 0.7
	ring.height = 0.025
	ring.radial_segments = 20
	_cue.mesh = ring
	_cue.position.y = 0.025
	_cue.material_override = director.material_for(Color(1.0, 0.68, 0.08), true)
	_cue.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_cue.visible = false
	add_child(_cue)

func set_revealed(value: bool) -> void:
	if value == _revealed:
		return
	_revealed = value
	visible = value
	collision_layer = 2 if value else 0
	if _shape:
		_shape.set_deferred("disabled", not value)
	if not value:
		set_awake(false)

func set_awake(value: bool) -> void:
	if value and not _revealed:
		return
	if phase == Phase.DEAD:
		return
	awake = value
	set_physics_process(value)
	if value and phase == Phase.SLEEP:
		phase = Phase.CHASE
	elif not value:
		phase = Phase.SLEEP
		velocity = Vector3.ZERO
		if _cue:
			_cue.visible = false

func think(_delta: float) -> void:
	if not awake or phase != Phase.CHASE or not is_instance_valid(director.player):
		return
	var player_position: Vector3 = director.player.global_position
	var distance: float = global_position.distance_to(player_position)
	var attack_range: float = float(profile.get("range", 2.1))
	if distance <= attack_range and _cooldown <= 0.0 and director.has_cover_clear(global_position, player_position):
		begin_attack(choose_attack())
	elif _waypoint == Vector3.ZERO or global_position.distance_to(_waypoint) < 0.26:
		_waypoint = director.navigation_target(global_position)

func choose_attack() -> Dictionary:
	return {
		"pattern": str(profile.get("pattern", "melee")),
		"damage": float(profile.get("damage", 16.0)),
		"range": float(profile.get("range", 2.1)),
		"tell": maxf(0.55, float(profile.get("tell", 0.7))),
		"recovery": float(profile.get("recovery", 0.8)),
		"speed": float(profile.get("charge_speed", 5.0)),
		"duration": float(profile.get("duration", 0.55)),
		"shots": int(profile.get("shots", 1))
	}

func begin_attack(attack: Dictionary) -> void:
	_attack = attack
	_attack["tell"] = maxf(0.5, float(_attack.get("tell", 0.7)))
	_aim = director.player.global_position - global_position
	_aim.y = 0.0
	_aim = _aim.normalized() if _aim.length_squared() > 0.01 else Vector3.FORWARD
	phase = Phase.WINDUP
	_timer = float(_attack["tell"])
	_hit = false
	_cue.visible = true
	var pattern: String = str(_attack.get("pattern", "melee"))
	var radius: float = float(_attack.get("range", 2.1)) if pattern == "slam" else (1.2 if is_boss else 0.7)
	_cue.scale = Vector3(radius / 0.7, 1.0, radius / 0.7)
	velocity.x = 0.0
	velocity.z = 0.0

func _physics_process(delta: float) -> void:
	if phase == Phase.DEAD:
		_timer -= delta
		_visual.scale = _visual.scale.lerp(Vector3.ONE * 0.05, delta * 4.0)
		if _timer <= 0.0:
			queue_free()
		return
	_clock += delta
	_cooldown = maxf(0.0, _cooldown - delta)
	_timer -= delta
	if not is_on_floor():
		velocity.y -= 18.0 * delta
	else:
		velocity.y = 0.0
	velocity.x = 0.0
	velocity.z = 0.0
	match phase:
		Phase.CHASE:
			_move_to_waypoint()
		Phase.WINDUP:
			_visual.rotation.x = sin(_clock * 12.0) * 0.05
			if _timer <= 0.0:
				_activate_attack()
		Phase.ACTIVE:
			_process_active(delta)
			if _timer <= 0.0:
				_finish_attack()
		Phase.RECOVERY, Phase.STAGGER:
			if _timer <= 0.0:
				phase = Phase.CHASE
				_visual.rotation.x = 0.0
	move_and_slide()

func _move_to_waypoint() -> void:
	if _waypoint == Vector3.ZERO:
		return
	var offset: Vector3 = _waypoint - global_position
	offset.y = 0.0
	if offset.length() <= 0.16:
		return
	var heading = offset.normalized()
	var move_speed: float = float(profile.get("speed", 2.3))
	velocity.x = heading.x * move_speed
	velocity.z = heading.z * move_speed
	_visual.rotation.y = atan2(-heading.x, -heading.z)
	_aim = heading
	_visual.position.y = sin(_clock * 7.0) * 0.035

func _activate_attack() -> void:
	phase = Phase.ACTIVE
	_timer = float(_attack.get("duration", 0.18))
	_cue.visible = false
	var pattern: String = str(_attack.get("pattern", "melee"))
	if pattern in ["ranged", "fan"]:
		var shots: int = mini(5, int(_attack.get("shots", 1)))
		for i in range(shots):
			var angle: float = (float(i) - float(shots - 1) * 0.5) * 0.17
			director.fire_projectile(self, _aim.rotated(Vector3.UP, angle), float(_attack.get("damage", 15.0)), float(_attack.get("projectile_speed", 8.0)), profile.get("color", Color.ORANGE))
	elif pattern == "breath":
		_bursts_left = 5
		_burst_timer = 0.0
	elif pattern == "blink":
		var destination: Vector3 = director.retreat_target(global_position)
		if director.has_cover_clear(global_position, destination):
			global_position = destination
		_timer = 0.12
	elif pattern == "slam":
		_try_hit_player(false)
	elif pattern not in ["charge", "dive"]:
		_try_hit_player(true)

func _process_active(delta: float) -> void:
	var pattern: String = str(_attack.get("pattern", "melee"))
	if pattern in ["charge", "dive"]:
		var move_speed: float = float(_attack.get("speed", 6.0))
		velocity.x = _aim.x * move_speed
		velocity.z = _aim.z * move_speed
		_try_hit_player(true, 2.25 if is_boss else 1.65)
		if is_on_wall():
			_timer = 0.0
	elif pattern == "breath":
		_burst_timer -= delta
		if _burst_timer <= 0.0 and _bursts_left > 0:
			director.fire_projectile(self, _aim, float(_attack.get("damage", 12.0)), 10.0, Color(1.0, 0.35, 0.06))
			_bursts_left -= 1
			_burst_timer = 0.16

func _try_hit_player(directional: bool, range_override: float = -1.0) -> void:
	if _hit or not is_instance_valid(director.player):
		return
	var offset: Vector3 = director.player.global_position - global_position
	offset.y = 0.0
	var reach: float = range_override if range_override > 0.0 else float(_attack.get("range", 2.1))
	if offset.length() > reach:
		return
	if directional and offset.length() > 0.1 and _aim.dot(offset.normalized()) < 0.25:
		return
	if not director.has_cover_clear(global_position, director.player.global_position):
		return
	director.player.take_damage(float(_attack.get("damage", 16.0)), global_position)
	_hit = true

func _finish_attack() -> void:
	phase = Phase.RECOVERY
	_timer = float(_attack.get("recovery", 0.8))
	_cooldown = _timer + 0.4
	_visual.rotation.x = 0.15
	_waypoint = Vector3.ZERO
	_bursts_left = 0

func take_damage(amount: float, stagger: float = 0.0, source_position: Vector3 = Vector3.ZERO) -> void:
	if not _revealed or phase == Phase.DEAD or amount <= 0.0:
		return
	var actual_damage: float = amount
	if str(profile.get("pattern", "")) == "guard" and phase == Phase.CHASE:
		var incoming: Vector3 = source_position - global_position
		incoming.y = 0.0
		if incoming.length() > 0.1 and incoming.normalized().dot(_aim) > 0.35:
			actual_damage *= 0.55
	hp = maxf(0.0, hp - actual_damage)
	_posture += actual_damage
	if hp <= 0.0:
		die()
		return
	if stagger > 0.0 and (not is_boss or _posture >= max_hp * 0.18):
		phase = Phase.STAGGER
		_timer = clampf(stagger * (1.6 if is_boss else 1.0), 0.2, 1.2)
		_posture = 0.0
		_cue.visible = false
	set_awake(true)

func die() -> void:
	if phase == Phase.DEAD:
		return
	hp = 0.0
	phase = Phase.DEAD
	awake = false
	_timer = 0.85
	_cue.visible = false
	_shape.set_deferred("disabled", true)
	set_physics_process(true)
	defeated.emit(self)
