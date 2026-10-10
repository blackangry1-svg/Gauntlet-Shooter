class_name AdventureFeature
extends StaticBody3D

var world: Node
var data: Dictionary = {}
var visual: MeshInstance3D
var collider: CollisionShape3D
var label: Label3D

func configure(owner_world: Node, definition: Dictionary) -> void:
	world = owner_world
	data = definition.duplicate(true)
	position = data["position"]
	name = str(data["id"])
	rotation.y = float(data.get("rotation_y", 0.0))
	collision_layer = 8
	collision_mask = 0
	add_to_group("adventure_features")
	var kind: String = str(data["kind"])
	var size: Vector3 = Vector3(0.65, 0.8, 0.65)
	if kind in ["gate", "shortcut", "wind_gate", "arcane_gate", "dive_hatch"]:
		size = Vector3(2.9, 2.7, 0.36)
	elif kind == "bridge":
		size = Vector3(2.9, 1.8, 0.32)
	elif kind == "bridge_lever":
		size = Vector3(0.8, 0.8, 0.8)
	elif kind == "water_key":
		size = Vector3(0.3, 0.38, 0.3)
	elif kind == "return_bubble":
		size = Vector3(0.42, 0.68, 0.42)
	collider = CollisionShape3D.new()
	var shape: BoxShape3D = BoxShape3D.new()
	shape.size = size
	collider.shape = shape
	add_child(collider)
	visual = MeshInstance3D.new()
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = size
	visual.mesh = mesh
	if kind == "return_bubble":
		var bubble: SphereMesh = SphereMesh.new()
		bubble.radius = 0.13
		bubble.height = 0.26
		bubble.radial_segments = 8
		bubble.rings = 4
		visual.mesh = bubble
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = data.get("color", Color(0.8, 0.55, 0.16))
	material.roughness = 1.0
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	visual.material_override = material
	visual.visibility_range_end = 38.0
	add_child(visual)
	if kind == "return_bubble":
		for i in range(2):
			var small_bubble: MeshInstance3D = MeshInstance3D.new()
			small_bubble.mesh = visual.mesh
			small_bubble.material_override = material
			small_bubble.position = Vector3(-0.10 if i == 0 else 0.10, 0.20 + float(i) * 0.16, 0.03)
			small_bubble.scale = Vector3.ONE * (0.7 if i == 0 else 0.5)
			visual.add_child(small_bubble)
	label = Label3D.new()
	label.text = str(data.get("label", kind.replace("_", " ").capitalize()))
	label.position.y = size.y * 0.5 + 0.2
	label.font_size = 28
	label.pixel_size = 0.0015
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = false
	label.visibility_range_begin = 2.5
	label.visibility_range_end = 8.0
	add_child(label)
	refresh()

func _state() -> Node:
	return world.state if is_instance_valid(world) else null

func _done() -> bool:
	var state: Node = _state()
	return state != null and state.has_flag(world.current_floor, str(data.get("flag", data["id"])))

func refresh() -> void:
	if not is_instance_valid(visual):
		return
	var kind: String = str(data["kind"])
	var done: bool = _done()
	var blocking: bool = kind in ["gate", "shortcut", "bridge", "wind_gate", "arcane_gate", "dive_hatch"]
	if kind == "dive_hatch":
		done = false
	if kind in ["gate", "shortcut", "bridge", "wind_gate", "arcane_gate"]:
		visual.visible = not done
		label.visible = not done
		collision_layer = 9 if not done else 0
	elif kind in ["key", "water_key", "chest", "loot", "secret_staff", "secret_spear"]:
		visual.visible = not done
		label.visible = not done
		collision_layer = 8 if not done else 0
	else:
		collision_layer = 9 if blocking else 8
	visual.visible = visual.visible and kind != "dive_hatch"
	label.visible = label.visible and kind != "dive_hatch"

func prompt() -> String:
	var kind: String = str(data["kind"])
	var state: Node = _state()
	if state == null:
		return ""
	if _done() and kind in ["key", "water_key", "chest", "loot", "secret_staff", "secret_spear", "gate", "shortcut", "bridge", "wind_gate", "arcane_gate"]:
		return ""
	match kind:
		"checkpoint": return "Rest: heal, refill arrows and charges, save checkpoint"
		"lift_up", "lift_down", "exit": return str(data.get("label", "Use tower lift"))
		"gate": return "Open key gate" if state.has_flag(world.current_floor, "key_collected") else "Find this floor's key"
		"shortcut": return "Return passage: find its far-side lever"
		"lever": return "Pull lever: open permanent return shortcut"
		"bridge_lever": return "Shoot the raised chain ring with the bow"
		"bridge": return "Raised lava bridge: shoot its chain ring"
		"dive_station": return "Dive for the submerged key" if state.has_item("tide_charm") else "Diving requires the Tide Charm"
		"return_bubble": return "Ride the bubbles back to the dry passage"
		"wind_gate": return "Use Gale Mantle to still the wind" if state.has_item("gale_mantle") else "The Gale Mantle is required"
		"arcane_gate": return "Reveal the true passage" if state.has_item("aether_sight") else "Aether Sight is required"
		"secret_staff": return "Burn the sealed roots with a staff shot" if state.has_item("aether_sight") else "Ancient root ward: Aether Sight reveals its seal"
		"secret_spear": return "Strike the grate mechanism with the spear" if state.has_item("aether_sight") else "Ancient grate ward: Aether Sight reveals its seal"
		"merchant": return "Free the imprisoned smith" if not state.has_flag(world.current_floor, "merchant_free") else "Browse weapon and relic upgrades"
		"water_key": return "Recover the submerged Tide Key"
		"key": return "Take the floor key"
		"chest": return "Open weapon chest"
		"loot": return "Collect supplies and Embers"
	return ""

func interact(player: Node) -> void:
	var state: Node = _state()
	if state == null:
		return
	var kind: String = str(data["kind"])
	if _done() and kind in ["key", "water_key", "chest", "loot", "secret_staff", "secret_spear"]:
		return
	match kind:
		"checkpoint":
			state.set_checkpoint(world.current_floor, data["cell"])
			state.restock_at_checkpoint()
			if player.has_method("heal_to_full"):
				player.heal_to_full()
			state.save_game()
			world.notify("Rested. Supplies replenished; checkpoint saved.")
		"key", "water_key":
			if kind == "water_key" and (not state.has_item("tide_charm") or player.global_position.y > -1.0):
				world.notify("The Tide Key lies underwater. Use the dive station.")
				return
			state.set_flag(world.current_floor, "key_collected")
			world.notify("Floor key recovered.")
		"gate":
			if state.has_flag(world.current_floor, "key_collected"):
				state.set_flag(world.current_floor, "gate_open")
			else:
				world.notify("This floor's key is still missing.")
		"lever":
			state.set_flag(world.current_floor, "shortcut_open")
			world.notify("The return shortcut remains open.")
		"bridge_lever", "bridge":
			world.notify("Aim a bow shot at the raised chain ring. Rest to refill arrows.")
		"dive_station":
			world.begin_dive(player)
		"return_bubble":
			world.end_dive(player)
		"lift_up", "lift_down", "exit":
			var target: int = int(data.get("target_floor", world.current_floor))
			if state.can_travel_to(target):
				world.travel_requested.emit(target)
			else:
				world.notify("This lift is sealed. Defeat the guardian; the final lift also needs both hidden seals.")
		"wind_gate", "arcane_gate":
			var item: String = "gale_mantle" if kind == "wind_gate" else "aether_sight"
			if state.has_item(item):
				state.set_flag(world.current_floor, str(data["flag"]))
			else:
				world.notify("You need " + item.replace("_", " ").capitalize() + ".")
		"chest":
			for item in data.get("items", []):
				state.acquire_item(str(item))
			state.set_flag(world.current_floor, str(data["flag"]))
			world.notify("Weapon chest opened.")
		"loot":
			state.souls += 20
			if state.has_item("bow"):
				state.add_ammo("bow", 8)
			if state.has_item("staff"):
				state.add_ammo("staff", 3)
			state.set_flag(world.current_floor, str(data["flag"]))
			state.set_flag(world.current_floor, "hidden_guardian_awake")
			state.inventory_changed.emit()
			world.notify("Recovered 20 Embers and supplies.")
		"merchant":
			if not state.has_flag(world.current_floor, "merchant_free"):
				state.set_flag(world.current_floor, "merchant_free")
				world.notify("The smith is free. Speak again to browse weapon and relic upgrades.")
			elif not world.merchant_requested.get_connections().is_empty():
				world.merchant_requested.emit()
			else:
				var upgraded: bool = state.upgrade_tool(str(state.equipped_weapon))
				world.notify("Tool improved." if upgraded else "More Embers are needed, or this tool is fully improved.")
		"secret_staff", "secret_spear":
			world.notify(prompt())
	world.refresh_features()

func hit_weapon(weapon_id: String) -> void:
	var state: Node = _state()
	if state == null:
		return
	var kind: String = str(data["kind"])
	if kind == "bridge_lever" and weapon_id == "bow" and state.has_item("bow"):
		state.set_flag(world.current_floor, "bridge_lowered")
		world.notify("The lava bridge has lowered.")
	elif kind == "secret_staff" and weapon_id == "staff" and state.has_item("staff") and state.has_item("aether_sight") and not _done():
		state.acquire_item("sun_seal")
		state.set_flag(world.current_floor, str(data["flag"]))
		state.set_flag(world.current_floor, "hidden_guardian_awake")
		world.notify("The roots burn away. Sun Seal recovered.")
	elif kind == "secret_spear" and weapon_id == "spear" and state.has_item("spear") and state.has_item("aether_sight") and not _done():
		state.acquire_item("moon_seal")
		state.set_flag(world.current_floor, str(data["flag"]))
		state.set_flag(world.current_floor, "hidden_guardian_awake")
		world.notify("The long grate mechanism yields the Moon Seal.")
	world.refresh_features()

