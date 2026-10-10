class_name Projectile
extends Area3D

var damage: float = 35.0
var speed: float = 25.0
var direction: Vector3 = Vector3.FORWARD
var lifetime: float = 4.0
var is_enemy_projectile: bool = false
var blast_radius: float = 0.0
var stagger_duration: float = 0.5
var source_node: Node = null

var _time_alive: float = 0.0
var _mesh_instance: MeshInstance3D

func _ready() -> void:
	monitoring = true
	monitorable = true
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)
	_setup_visuals()

func _setup_visuals() -> void:
	_mesh_instance = MeshInstance3D.new()
	
	# Orient projectile along its travel direction
	if direction.length_squared() > 0.001:
		var forward = direction.normalized()
		var up = Vector3.UP if abs(forward.y) < 0.9 else Vector3.FORWARD
		look_at(global_position + forward, up)
		
	if blast_radius > 0.0:
		# Fireball projectile
		var sphere = SphereMesh.new()
		sphere.radius = 0.3
		sphere.height = 0.6
		_mesh_instance.mesh = sphere
		
		var mat = StandardMaterial3D.new()
		mat.albedo_color = Color(1.0, 0.45, 0.1)
		mat.emission_enabled = true
		mat.emission = Color(1.0, 0.35, 0.05)
		mat.emission_energy_multiplier = 4.0
		_mesh_instance.material_override = mat
		add_child(_mesh_instance)
		
		var light = OmniLight3D.new()
		light.light_color = Color(1.0, 0.5, 0.1)
		light.light_energy = 3.0
		light.omni_range = 6.0
		add_child(light)
		
		_add_trail_particles(Color(1.0, 0.4, 0.05))
	else:
		# Visible glowing 3D arrow with shaft, glowing arrowhead, and fletching
		var shaft = CylinderMesh.new()
		shaft.top_radius = 0.035
		shaft.bottom_radius = 0.035
		shaft.height = 0.85
		_mesh_instance.mesh = shaft
		_mesh_instance.rotation_degrees.x = 90.0
		
		var shaft_mat = StandardMaterial3D.new()
		if is_enemy_projectile:
			shaft_mat.albedo_color = Color(0.45, 0.2, 0.6)
		else:
			shaft_mat.albedo_color = Color(0.85, 0.7, 0.35)
		_mesh_instance.material_override = shaft_mat
		add_child(_mesh_instance)
		
		# Glowing arrowhead tip
		var tip_mesh = MeshInstance3D.new()
		var cone = CylinderMesh.new()
		cone.top_radius = 0.005
		cone.bottom_radius = 0.09
		cone.height = 0.24
		tip_mesh.mesh = cone
		tip_mesh.rotation_degrees.x = 90.0
		tip_mesh.position.z = -0.5
		
		var tip_mat = StandardMaterial3D.new()
		tip_mat.emission_enabled = true
		if is_enemy_projectile:
			tip_mat.albedo_color = Color(1.0, 0.25, 0.95)
			tip_mat.emission = Color(0.95, 0.15, 1.0)
			tip_mat.emission_energy_multiplier = 5.0
		else:
			tip_mat.albedo_color = Color(1.0, 0.9, 0.3)
			tip_mat.emission = Color(1.0, 0.85, 0.2)
			tip_mat.emission_energy_multiplier = 4.0
		tip_mesh.material_override = tip_mat
		add_child(tip_mesh)
		
		# Light illumination
		var light = OmniLight3D.new()
		if is_enemy_projectile:
			light.light_color = Color(0.9, 0.2, 1.0)
			light.light_energy = 2.6
			light.omni_range = 4.5
		else:
			light.light_color = Color(1.0, 0.85, 0.3)
			light.light_energy = 2.2
			light.omni_range = 4.0
		add_child(light)
		
		_add_trail_particles(Color(0.9, 0.2, 1.0) if is_enemy_projectile else Color(1.0, 0.85, 0.3))
	
	var col = CollisionShape3D.new()
	var shape = SphereShape3D.new()
	shape.radius = 0.35
	col.shape = shape
	add_child(col)

func _add_trail_particles(trail_color: Color) -> void:
	var trail = CPUParticles3D.new()
	trail.amount = 20
	trail.lifetime = 0.25
	trail.local_coords = false
	trail.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	trail.emission_sphere_radius = 0.08
	trail.gravity = Vector3.ZERO
	
	var p_mesh = SphereMesh.new()
	p_mesh.radius = 0.05
	p_mesh.height = 0.1
	var p_mat = StandardMaterial3D.new()
	p_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	p_mat.albedo_color = trail_color
	p_mesh.material = p_mat
	trail.mesh = p_mesh
	add_child(trail)

func _physics_process(delta: float) -> void:
	var move_step = direction * speed * delta
	var target_pos = global_position + move_step
	
	# Sacred bonfire sanctuary barrier: dispel hostile arrows approaching holy ground
	if is_enemy_projectile:
		var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
		if global_singleton and global_singleton.is_in_sanctuary:
			if global_position.distance_to(global_singleton.active_bonfire_position) < 6.5:
				queue_free()
				return
	
	# Raycast sweep continuous collision detection against walls, pillars, and actors
	var space = get_world_3d().direct_space_state
	if space != null:
		var ray_query = PhysicsRayQueryParameters3D.create(global_position, target_pos)
		ray_query.collide_with_areas = false
		ray_query.collide_with_bodies = true
		ray_query.exclude = [self]
		if source_node != null:
			ray_query.exclude.append(source_node)
			
		var hit = space.intersect_ray(ray_query)
		if not hit.is_empty():
			var collider = hit.get("collider")
			global_position = hit.get("position")
			_impact(collider)
			return
			
	global_position = target_pos
	_time_alive += delta
	if _time_alive >= lifetime:
		queue_free()

func _on_body_entered(body: Node) -> void:
	if body == source_node:
		return
	_impact(body)

func _on_area_entered(area: Node) -> void:
	if area == source_node or area.get_parent() == source_node:
		return
	if area.has_method("take_hit"):
		area.take_hit(damage, stagger_duration, direction)
		queue_free()

func _impact(hit_target: Node) -> void:
	if is_queued_for_deletion():
		return
	if blast_radius > 0.0:
		_explode()
	else:
		if hit_target != null:
			if is_enemy_projectile:
				# Enemy arrow: only damage player, not enemy allies
				if hit_target.is_in_group("player") and hit_target.has_method("take_damage"):
					hit_target.take_damage(damage, stagger_duration, direction)
			else:
				# Player projectile: only damage non-player targets
				if hit_target.has_method("take_damage") and not hit_target.is_in_group("player"):
					hit_target.take_damage(damage, stagger_duration, direction)
	queue_free()

func _explode() -> void:
	var space = get_world_3d().direct_space_state
	var query = PhysicsShapeQueryParameters3D.new()
	var sphere = SphereShape3D.new()
	sphere.radius = blast_radius
	query.shape = sphere
	query.transform = Transform3D(Basis(), global_position)
	var hits = space.intersect_shape(query, 16)
	for hit in hits:
		var collider = hit.get("collider")
		if collider and collider != source_node and collider.has_method("take_damage"):
			var dist = global_position.distance_to(collider.global_position)
			var falloff = clamp(1.0 - (dist / blast_radius), 0.2, 1.0)
			collider.take_damage(damage * falloff, stagger_duration, (collider.global_position - global_position).normalized())

