class_name AdventureHostileProjectile
extends Node3D

var director: Node
var source: Node
var direction: Vector3 = Vector3.FORWARD
var damage: float = 12.0
var speed: float = 8.0
var color: Color = Color.ORANGE
var _age: float = 0.0
var _source_position: Vector3

func _ready() -> void:
	add_to_group("adventure_projectile")
	add_to_group("adventure_hostile_projectile")
	_source_position = source.global_position if is_instance_valid(source) else global_position
	var visual = MeshInstance3D.new()
	var mesh = SphereMesh.new()
	mesh.radius = 0.1
	mesh.height = 0.2
	mesh.radial_segments = 6
	mesh.rings = 3
	visual.mesh = mesh
	visual.material_override = director.material_for(color, true)
	visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(visual)

func _physics_process(delta: float) -> void:
	_age += delta
	if _age >= 3.2:
		queue_free()
		return
	var destination: Vector3 = global_position + direction * speed * delta
	var query = PhysicsRayQueryParameters3D.create(global_position, destination, 5)
	if is_instance_valid(source) and source is CollisionObject3D:
		query.exclude = [source.get_rid()]
	var hit: Dictionary = get_world_3d().direct_space_state.intersect_ray(query)
	if not hit.is_empty():
		var body: Object = hit.get("collider")
		if body == director.player and body.has_method("take_damage"):
			body.take_damage(damage, _source_position)
		queue_free()
		return
	global_position = destination
