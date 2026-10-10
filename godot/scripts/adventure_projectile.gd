extends Area3D

var weapon_id: String = "bow"
var damage: float = 28.0
var stagger: float = 0.25
var speed: float = 32.0
var direction: Vector3 = Vector3.FORWARD
var source_position: Vector3 = Vector3.ZERO
var owner_actor: Node3D
var blast_radius: float = 0.0
var remaining_life: float = 3.0
var _spent: bool = false

func _ready() -> void:
	add_to_group("adventure_projectile")
	collision_layer = 0
	collision_mask = 11
	monitorable = false
	body_entered.connect(_impact)
	area_entered.connect(_impact)
	var collision: CollisionShape3D = CollisionShape3D.new()
	var sphere: SphereShape3D = SphereShape3D.new()
	sphere.radius = 0.08
	collision.shape = sphere
	add_child(collision)
	var visual: MeshInstance3D = MeshInstance3D.new()
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color(1.0, 0.37, 0.12) if weapon_id == "staff" else Color(0.85, 0.73, 0.45)
	if weapon_id == "staff":
		var orb: SphereMesh = SphereMesh.new()
		orb.radius = 0.13
		orb.height = 0.26
		visual.mesh = orb
	else:
		var arrow: BoxMesh = BoxMesh.new()
		arrow.size = Vector3(0.045, 0.045, 0.52)
		visual.mesh = arrow
	visual.material_override = material
	visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(visual)
	if direction.length_squared() > 0.01:
		look_at(global_position + direction, Vector3.UP)

func _physics_process(delta: float) -> void:
	if _spent:
		return
	if remaining_life <= 0.0:
		queue_free()
		return
	var travel_delta: float = minf(delta, remaining_life)
	remaining_life -= delta
	var destination: Vector3 = global_position + direction * speed * travel_delta
	var ray: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(global_position, destination, 11)
	ray.collide_with_areas = true
	ray.exclude = [get_rid()]
	if owner_actor is CollisionObject3D:
		ray.exclude.append(owner_actor.get_rid())
	var hit: Dictionary = get_world_3d().direct_space_state.intersect_ray(ray)
	if not hit.is_empty():
		global_position = hit["position"]
		_impact(hit["collider"])
	else:
		global_position = destination
		if remaining_life <= 0.0:
			queue_free()

func _impact(target: Node) -> void:
	if _spent or target == owner_actor:
		return
	_spent = true
	if target != null and target.has_method("hit_weapon"):
		target.hit_weapon(weapon_id)
	if blast_radius > 0.0:
		_explode()
	elif target != null and target.has_method("take_damage"):
		target.take_damage(damage, stagger, source_position)
	queue_free()

func _explode() -> void:
	var shape: SphereShape3D = SphereShape3D.new()
	shape.radius = blast_radius
	var query: PhysicsShapeQueryParameters3D = PhysicsShapeQueryParameters3D.new()
	query.shape = shape
	query.transform = Transform3D(Basis(), global_position)
	query.collision_mask = 2
	var hits: Array[Dictionary] = get_world_3d().direct_space_state.intersect_shape(query, 12)
	var touched: Dictionary = {}
	for hit: Dictionary in hits:
		var target: Node3D = hit.get("collider") as Node3D
		if target == null or target == owner_actor or not target.has_method("take_damage") or touched.has(target.get_instance_id()):
			continue
		touched[target.get_instance_id()] = true
		var point: Vector3 = target.global_position + Vector3.UP * 0.7
		var ray: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(global_position - direction * 0.10, point, 3)
		ray.exclude = [get_rid()]
		if owner_actor is CollisionObject3D:
			ray.exclude.append(owner_actor.get_rid())
		var obstruction: Dictionary = get_world_3d().direct_space_state.intersect_ray(ray)
		if not obstruction.is_empty() and obstruction.get("collider") != target:
			continue
		var falloff: float = clampf(1.0 - global_position.distance_to(point) / (blast_radius * 1.5), 0.4, 1.0)
		target.take_damage(damage * falloff, stagger, source_position)
