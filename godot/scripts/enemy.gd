class_name CitadelEnemy
extends CharacterBody3D

enum EnemyType {
	ORC_GRUNT,
	SKELETON_ARCHER,
	LAVA_GOLEM,
	DEATH_KNIGHT
}

var AudioSynthScript = load("res:/" + "/scripts/audio_synth.gd")
var ProjectileScript = load("res:/" + "/scripts/projectile.gd")

@export var enemy_type: EnemyType = EnemyType.ORC_GRUNT
@export var max_hp: float = 75.0
@export var speed: float = 3.8
@export var damage: float = 24.0
@export var attack_range: float = 2.2
@export var attack_cooldown: float = 1.2

var current_hp: float = 75.0
var target_player: CharacterBody3D = null
var is_staggered: bool = false
var stagger_timer: float = 0.0

var _cooldown_timer: float = 0.0
var _visual: Node3D
var _audio_synth: Node
var _hp_bar_fill: MeshInstance3D = null
var _hp_bar_root: Node3D = null

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

func _ready() -> void:
	add_to_group("enemy")
	_setup_stats_by_type()
	_setup_visuals()
	_update_health_bar()
	
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton and global_singleton.audio_synth != null:
		_audio_synth = global_singleton.audio_synth
	else:
		_audio_synth = AudioSynthScript.new()
		add_child(_audio_synth)

func _setup_stats_by_type() -> void:
	match enemy_type:
		EnemyType.ORC_GRUNT:
			max_hp = 65.0
			speed = 4.2
			damage = 22.0
			attack_range = 2.4
			attack_cooldown = 1.1
		EnemyType.SKELETON_ARCHER:
			max_hp = 45.0
			speed = 3.2
			damage = 28.0
			attack_range = 18.0
			attack_cooldown = 2.0
		EnemyType.LAVA_GOLEM:
			max_hp = 180.0
			speed = 2.8
			damage = 40.0
			attack_range = 2.8
			attack_cooldown = 1.8
		EnemyType.DEATH_KNIGHT:
			max_hp = 450.0
			speed = 4.5
			damage = 45.0
			attack_range = 3.2
			attack_cooldown = 1.4
	current_hp = max_hp

func _setup_visuals() -> void:
	# Clear previous visuals if reinitializing
	if _visual != null and is_instance_valid(_visual):
		_visual.queue_free()
	if _hp_bar_root != null and is_instance_valid(_hp_bar_root):
		_hp_bar_root.queue_free()

	_visual = Node3D.new()
	add_child(_visual)
	
	var bar_y = 2.3
	var enemy_display_name = "Orc Grunt"
	var bar_fill_color = Color(0.2, 0.9, 0.2)
	
	match enemy_type:
		EnemyType.ORC_GRUNT:
			enemy_display_name = "Orc Grunt"
			bar_fill_color = Color(0.25, 0.85, 0.2)
			_build_orc_grunt_mesh()
		EnemyType.SKELETON_ARCHER:
			enemy_display_name = "Skeleton Archer"
			bar_fill_color = Color(0.2, 0.85, 1.0)
			_build_skeleton_archer_mesh()
		EnemyType.LAVA_GOLEM:
			enemy_display_name = "Lava Golem"
			bar_fill_color = Color(1.0, 0.5, 0.1)
			bar_y = 2.9
			_build_lava_golem_mesh()
		EnemyType.DEATH_KNIGHT:
			enemy_display_name = "Death Knight"
			bar_fill_color = Color(0.9, 0.15, 0.25)
			bar_y = 2.8
			_build_death_knight_mesh()
			
	# Attach iconic Gauntlet billboard sprite overlay
	_attach_sprite_billboard()
	
	# Floating billboarded 3D health bar and name banner
	_build_overhead_health_bar(bar_y, enemy_display_name, bar_fill_color)
	
	# Collision capsule if not already present
	var existing_col = get_node_or_null("CollisionShape3D")
	if existing_col == null:
		var col = CollisionShape3D.new()
		var cap = CapsuleShape3D.new()
		cap.radius = 0.6 if enemy_type != EnemyType.LAVA_GOLEM else 0.9
		cap.height = 2.0 if enemy_type != EnemyType.LAVA_GOLEM else 2.6
		col.shape = cap
		col.position.y = 1.0 if enemy_type != EnemyType.LAVA_GOLEM else 1.3
		add_child(col)

func _build_orc_grunt_mesh() -> void:
	# Glowing runic base pedestal
	var pedestal = MeshInstance3D.new()
	var pcyl = CylinderMesh.new()
	pcyl.top_radius = 0.85
	pcyl.bottom_radius = 0.85
	pcyl.height = 0.06
	pedestal.mesh = pcyl
	pedestal.position.y = 0.03
	var ped_mat = StandardMaterial3D.new()
	ped_mat.albedo_color = Color(0.2, 0.35, 0.15)
	ped_mat.emission_enabled = true
	ped_mat.emission = Color(0.25, 0.7, 0.15)
	ped_mat.emission_energy_multiplier = 1.8
	pedestal.material_override = ped_mat
	_visual.add_child(pedestal)
	
	# Warm amber illumination
	var light = OmniLight3D.new()
	light.light_color = Color(1.0, 0.45, 0.15)
	light.light_energy = 2.0
	light.omni_range = 4.5
	light.position = Vector3(0, 1.2, 0.0)
	_visual.add_child(light)

func _build_skeleton_archer_mesh() -> void:
	# Spectral runic base pedestal
	var pedestal = MeshInstance3D.new()
	var pcyl = CylinderMesh.new()
	pcyl.top_radius = 0.8
	pcyl.bottom_radius = 0.8
	pcyl.height = 0.06
	pedestal.mesh = pcyl
	pedestal.position.y = 0.03
	var ped_mat = StandardMaterial3D.new()
	ped_mat.albedo_color = Color(0.1, 0.25, 0.35)
	ped_mat.emission_enabled = true
	ped_mat.emission = Color(0.15, 0.85, 1.0)
	ped_mat.emission_energy_multiplier = 2.0
	pedestal.material_override = ped_mat
	_visual.add_child(pedestal)
	
	# Spectral cyan illumination
	var light = OmniLight3D.new()
	light.light_color = Color(0.15, 0.85, 1.0)
	light.light_energy = 2.2
	light.omni_range = 4.8
	light.position = Vector3(0, 1.2, 0.0)
	_visual.add_child(light)

func _build_lava_golem_mesh() -> void:
	# Fiery molten runic pedestal
	var pedestal = MeshInstance3D.new()
	var pcyl = CylinderMesh.new()
	pcyl.top_radius = 1.15
	pcyl.bottom_radius = 1.15
	pcyl.height = 0.08
	pedestal.mesh = pcyl
	pedestal.position.y = 0.04
	var ped_mat = StandardMaterial3D.new()
	ped_mat.albedo_color = Color(0.35, 0.15, 0.05)
	ped_mat.emission_enabled = true
	ped_mat.emission = Color(1.0, 0.45, 0.05)
	ped_mat.emission_energy_multiplier = 2.5
	pedestal.material_override = ped_mat
	_visual.add_child(pedestal)
	
	# Blazing fiery illumination
	var light = OmniLight3D.new()
	light.light_color = Color(1.0, 0.45, 0.1)
	light.light_energy = 3.0
	light.omni_range = 5.8
	light.position = Vector3(0, 1.4, 0.0)
	_visual.add_child(light)

func _build_death_knight_mesh() -> void:
	# Abyssal shadow runic pedestal
	var pedestal = MeshInstance3D.new()
	var pcyl = CylinderMesh.new()
	pcyl.top_radius = 1.0
	pcyl.bottom_radius = 1.0
	pcyl.height = 0.07
	pedestal.mesh = pcyl
	pedestal.position.y = 0.035
	var ped_mat = StandardMaterial3D.new()
	ped_mat.albedo_color = Color(0.18, 0.05, 0.22)
	ped_mat.emission_enabled = true
	ped_mat.emission = Color(0.85, 0.15, 0.95)
	ped_mat.emission_energy_multiplier = 2.4
	pedestal.material_override = ped_mat
	_visual.add_child(pedestal)
	
	# Abyssal purple illumination
	var light = OmniLight3D.new()
	light.light_color = Color(0.85, 0.15, 0.95)
	light.light_energy = 2.8
	light.omni_range = 5.5
	light.position = Vector3(0, 1.4, 0.0)
	_visual.add_child(light)

func _attach_sprite_billboard() -> void:
	var sprite = Sprite3D.new()
	sprite.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
	sprite.shaded = false # Keep bright and illuminated in dark crypts
	sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	
	var sprite_path = "res:/" + "/assets/sprites/orc_grunt.png"
	var p_size = 0.012
	var hf = 6
	var vf = 6
	match enemy_type:
		EnemyType.ORC_GRUNT:
			sprite_path = "res:/" + "/assets/sprites/orc_grunt.png"
			p_size = 0.0125
			hf = 6
			vf = 6
		EnemyType.SKELETON_ARCHER:
			sprite_path = "res:/" + "/assets/sprites/skeleton_archer.png"
			p_size = 0.0125
			hf = 6
			vf = 6
		EnemyType.LAVA_GOLEM:
			sprite_path = "res:/" + "/assets/sprites/lava_golem.png"
			p_size = 0.011
			hf = 4
			vf = 4
		EnemyType.DEATH_KNIGHT:
			sprite_path = "res:/" + "/assets/sprites/death_knight.png"
			p_size = 0.0135
			hf = 6
			vf = 6
			
	var tex = load_texture_safe(sprite_path)
	if tex != null:
		sprite.texture = tex
	sprite.hframes = hf
	sprite.vframes = vf
	sprite.frame = 0
	sprite.pixel_size = p_size
	sprite.position.y = 1.15
	_visual.add_child(sprite)

func _build_overhead_health_bar(y_pos: float, enemy_name: String, fill_color: Color) -> void:
	_hp_bar_root = Node3D.new()
	_hp_bar_root.position.y = y_pos
	add_child(_hp_bar_root)
	
	# Background border bar
	var bg_mesh = MeshInstance3D.new()
	var bg_box = BoxMesh.new()
	bg_box.size = Vector3(1.2, 0.12, 0.04)
	bg_mesh.mesh = bg_box
	var bg_mat = StandardMaterial3D.new()
	bg_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bg_mat.albedo_color = Color(0.12, 0.12, 0.14)
	bg_mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	bg_mesh.material_override = bg_mat
	_hp_bar_root.add_child(bg_mesh)
	
	# Foreground health fill
	_hp_bar_fill = MeshInstance3D.new()
	var fill_box = BoxMesh.new()
	fill_box.size = Vector3(1.16, 0.08, 0.05)
	_hp_bar_fill.mesh = fill_box
	var fill_mat = StandardMaterial3D.new()
	fill_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fill_mat.albedo_color = fill_color
	fill_mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	_hp_bar_fill.material_override = fill_mat
	_hp_bar_root.add_child(_hp_bar_fill)
	
	# Overhead title Label3D positioned clearly above the bar
	var name_label = Label3D.new()
	name_label.text = enemy_name
	name_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	name_label.position.y = 0.28
	name_label.font_size = 28
	name_label.outline_size = 6
	name_label.modulate = Color(1.0, 1.0, 1.0)
	_hp_bar_root.add_child(name_label)

func _update_health_bar() -> void:
	if _hp_bar_fill != null and is_instance_valid(_hp_bar_fill):
		var ratio = clamp(current_hp / max_hp, 0.0, 1.0)
		_hp_bar_fill.scale.x = max(0.001, ratio)
		_hp_bar_fill.position.x = -0.58 * (1.0 - ratio)

func _physics_process(delta: float) -> void:
	if current_hp <= 0.0:
		return
		
	if not is_on_floor():
		velocity.y -= 18.0 * delta
		
	if target_player == null and get_tree() != null:
		var players = get_tree().get_nodes_in_group("player")
		if players.size() > 0:
			target_player = players[0]
			
	if is_staggered:
		stagger_timer -= delta
		velocity.x = 0.0
		velocity.z = 0.0
		if stagger_timer <= 0.0:
			is_staggered = false
		move_and_slide()
		return
		
	_cooldown_timer = max(0.0, _cooldown_timer - delta)
	
	if target_player != null and is_instance_valid(target_player):
		_process_ai(delta)
		if _hp_bar_root != null and is_instance_valid(_hp_bar_root):
			var cam_pos = target_player.global_position + Vector3(0, 1.65, 0)
			if _hp_bar_root.global_position.distance_squared_to(cam_pos) > 0.1:
				_hp_bar_root.look_at(cam_pos, Vector3.UP)
		
	move_and_slide()

func _has_line_of_sight_to_player() -> bool:
	if target_player == null or not is_instance_valid(target_player):
		return false
	var space = get_world_3d().direct_space_state
	if space == null:
		return false
	var from_pos = global_position + Vector3(0, 1.4, 0)
	var to_pos = target_player.global_position + Vector3(0, 1.2, 0)
	var query = PhysicsRayQueryParameters3D.create(from_pos, to_pos)
	query.collide_with_areas = false
	query.collide_with_bodies = true
	query.exclude = [self]
	var hit = space.intersect_ray(query)
	if hit.is_empty():
		return true
	var collider = hit.get("collider")
	if collider == target_player or (collider != null and collider.is_in_group("player")):
		return true
	return false

func _process_ai(delta: float) -> void:
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	# If player is resting in sacred bonfire sanctuary, enemies cannot attack
	if global_singleton and global_singleton.is_in_sanctuary:
		velocity.x = 0.0
		velocity.z = 0.0
		_cooldown_timer = max(_cooldown_timer, 1.0)
		return

	var dist = global_position.distance_to(target_player.global_position)
	var dir = (target_player.global_position - global_position)
	dir.y = 0.0
	var move_dir = dir.normalized() if dir.length() > 0.01 else Vector3.FORWARD
	
	# Face movement direction (-Z is forward!)
	if _visual != null and move_dir.length() > 0.01:
		if move_dir.cross(Vector3.UP).length() > 0.001:
			_visual.look_at(global_position + move_dir, Vector3.UP)
	
	# Aggro / detection range
	if dist > 26.0:
		velocity.x = 0.0
		velocity.z = 0.0
		return
	
	if enemy_type == EnemyType.SKELETON_ARCHER:
		var has_los = _has_line_of_sight_to_player()
		
		if not has_los:
			# Blocked by walls or pillars: advance and flank to acquire line of sight, DO NOT SHOOT
			var walk_dir = move_dir
			if is_on_wall():
				var normal = get_wall_normal()
				var tangent = normal.cross(Vector3.UP).normalized()
				if tangent.dot(move_dir) < 0:
					tangent = -tangent
				walk_dir = tangent
			velocity.x = walk_dir.x * speed
			velocity.z = walk_dir.z * speed
		else:
			# Has clear line of sight: tactical positioning
			if dist < 6.0:
				# Back up away from player
				velocity.x = -move_dir.x * speed
				velocity.z = -move_dir.z * speed
			elif dist > 14.0:
				# Move closer into optimal bow range
				velocity.x = move_dir.x * speed
				velocity.z = move_dir.z * speed
			else:
				# Optimal range pocket: hold ground
				velocity.x = 0.0
				velocity.z = 0.0
				
			if dist <= attack_range and _cooldown_timer <= 0.0:
				_shoot_projectile(move_dir)
	else:
		if dist > attack_range:
			velocity.x = move_dir.x * speed
			velocity.z = move_dir.z * speed
		else:
			velocity.x = 0.0
			velocity.z = 0.0
			if _cooldown_timer <= 0.0:
				_execute_melee_attack(move_dir)

func _execute_melee_attack(attack_dir: Vector3) -> void:
	_cooldown_timer = attack_cooldown
	if _audio_synth and _audio_synth.swing_wav:
		_audio_synth.play_sfx_3d(_audio_synth.swing_wav, global_position, 1.0)
	if target_player and is_instance_valid(target_player) and target_player.has_method("take_damage"):
		target_player.take_damage(damage, 0.4, attack_dir)

func _shoot_projectile(shoot_dir: Vector3) -> void:
	var from_pos = global_position + Vector3(0, 1.4, 0)
	var spawn_pos = from_pos + (shoot_dir * 0.8)
	
	# Wall safety check: don't spawn projectile inside geometry!
	var space = get_world_3d().direct_space_state
	if space != null:
		var check_query = PhysicsRayQueryParameters3D.create(from_pos, spawn_pos)
		check_query.exclude = [self]
		var wall_hit = space.intersect_ray(check_query)
		if not wall_hit.is_empty():
			return
			
	_cooldown_timer = attack_cooldown
	if _audio_synth and _audio_synth.swing_wav:
		_audio_synth.play_sfx_3d(_audio_synth.swing_wav, global_position, 1.0)
		
	var proj = ProjectileScript.new()
	proj.damage = damage
	proj.speed = 22.0
	
	# Aim directly at player's center
	var target_chest = target_player.global_position + Vector3(0, 1.1, 0) if (target_player and is_instance_valid(target_player)) else (from_pos + shoot_dir * 10.0)
	proj.direction = (target_chest - spawn_pos).normalized()
	proj.is_enemy_projectile = true
	proj.source_node = self
	
	var p = get_parent()
	if p != null:
		p.add_child(proj)
	elif get_tree() != null and get_tree().root != null:
		get_tree().root.add_child(proj)
		
	proj.global_position = spawn_pos

func take_damage(amount: float, stagger_dur: float = 0.5, impact_dir: Vector3 = Vector3.ZERO) -> void:
	current_hp -= amount
	_update_health_bar()
	
	if _audio_synth and _audio_synth.impact_wav:
		_audio_synth.play_sfx_3d(_audio_synth.impact_wav, global_position, 2.0)
	
	if stagger_dur >= 0.7:
		is_staggered = true
		stagger_timer = stagger_dur
		velocity = impact_dir * 4.0
	else:
		velocity = impact_dir * 1.5
		
	if current_hp <= 0.0:
		_die()

func _die() -> void:
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton:
		global_singleton.player_souls += int(max_hp)
	queue_free()
