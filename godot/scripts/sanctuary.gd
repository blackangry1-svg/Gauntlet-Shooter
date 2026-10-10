class_name Sanctuary
extends Area3D

@export var radius: float = 6.0
@export var heal_per_sec: float = 25.0

var _bonfire_mesh: MeshInstance3D
var _light: OmniLight3D
var _barrier_col: CollisionShape3D

func _ready() -> void:
	monitoring = true
	monitorable = true
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	area_entered.connect(_on_area_entered)
	_setup_visuals()

func _setup_visuals() -> void:
	_barrier_col = CollisionShape3D.new()
	var cyl = CylinderShape3D.new()
	cyl.radius = radius
	cyl.height = 4.0
	_barrier_col.shape = cyl
	add_child(_barrier_col)
	
	# Bonfire altar
	_bonfire_mesh = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = Vector3(1.2, 0.4, 1.2)
	_bonfire_mesh.mesh = box
	var stone_mat = StandardMaterial3D.new()
	stone_mat.albedo_color = Color(0.2, 0.2, 0.25)
	_bonfire_mesh.material_override = stone_mat
	add_child(_bonfire_mesh)
	
	# Warm flame light
	_light = OmniLight3D.new()
	_light.light_color = Color(1.0, 0.7, 0.25)
	_light.light_energy = 3.5
	_light.omni_range = radius * 1.5
	_light.position.y = 0.8
	add_child(_light)

func _physics_process(delta: float) -> void:
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton and global_singleton.is_in_sanctuary:
		# Ambient flicker
		_light.light_energy = 3.2 + sin(Time.get_ticks_msec() * 0.005) * 0.4
		global_singleton.set_dread(0.0)

	# Continuous area enforcement: heal players, repel stalkers
	for body in get_overlapping_bodies():
		if body.is_in_group("player"):
			if body.has_method("heal_continuous"):
				body.heal_continuous(heal_per_sec * delta)
		elif body.is_in_group("minotaur_stalker"):
			if body.has_method("repel_from_sanctuary"):
				body.repel_from_sanctuary(global_position, radius)

func _on_body_entered(body: Node) -> void:
	if body.is_in_group("player"):
		var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
		if global_singleton:
			global_singleton.is_in_sanctuary = true
			global_singleton.active_bonfire_position = global_position
			global_singleton.set_dread(0.0)
			global_singleton.taunt_emitted.emit("BONFIRE", "SANCTUARY FOUND — Rest and be healed in the sacred flame.")
		if body.has_method("rest_at_bonfire"):
			body.rest_at_bonfire()
	elif body.is_in_group("minotaur_stalker"):
		if body.has_method("repel_from_sanctuary"):
			body.repel_from_sanctuary(global_position, radius)

func _on_body_exited(body: Node) -> void:
	if body.is_in_group("player"):
		var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
		if global_singleton:
			global_singleton.is_in_sanctuary = false

func _on_area_entered(area: Area3D) -> void:
	if area != null and area.get("is_enemy_projectile") == true:
		area.queue_free()
