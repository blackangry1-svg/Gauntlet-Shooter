class_name AdventureBoss
extends AdventureEnemy

var _attack_index: int = 0

func build_visuals() -> void:
	var color: Color = profile.get("color", Color(0.5, 0.4, 0.6))
	match floor_index:
		0:
			add_box(Vector3(1.15, 1.15, 1.7), Vector3(0, 1.45, 0), color)
			for x in [-0.42, 0.42]:
				for z in [-0.52, 0.52]:
					add_box(Vector3(0.26, 1.15, 0.3), Vector3(x, 0.58, z), color.darkened(0.15))
			add_box(Vector3(0.48, 1.2, 0.5), Vector3(0, 2.25, -0.65), color)
			add_box(Vector3(0.65, 0.55, 0.95), Vector3(0, 2.9, -0.95), color.lightened(0.1))
			for side in [-1.0, 1.0]:
				var antler = add_box(Vector3(0.13, 1.0, 0.15), Vector3(side * 0.4, 3.6, -0.78), Color(0.7, 0.57, 0.29))
				antler.rotation.z = side * -0.4
				for tine in [0.0, 0.33]:
					var branch = add_box(Vector3(0.12, 0.47, 0.12), Vector3(side * (0.47 + tine), 3.65 + tine * 0.6, -0.78), Color(0.7, 0.57, 0.29))
					branch.rotation.z = side * 0.5
			add_sphere(0.25, Vector3(0, 1.72, -0.84), Color(1.0, 0.65, 0.08))
		1, 4:
			var robe = CylinderMesh.new()
			robe.top_radius = 0.28
			robe.bottom_radius = 0.65
			robe.height = 2.45
			robe.radial_segments = 8
			add_mesh(robe, Vector3(0, 1.25, 0), color)
			add_sphere(0.36, Vector3(0, 2.85, 0), color.lightened(0.35))
			add_box(Vector3(0.14, 3.2, 0.14), Vector3(-0.75, 1.65, -0.12), Color(0.45, 0.39, 0.28))
			add_sphere(0.25, Vector3(-0.75, 3.3, -0.12), Color(0.55, 0.85, 1.0) if floor_index == 1 else Color(0.9, 0.6, 1.0))
			if floor_index == 1:
				var bell = CylinderMesh.new()
				bell.top_radius = 0.12
				bell.bottom_radius = 0.35
				bell.height = 0.5
				bell.radial_segments = 8
				add_mesh(bell, Vector3(0.78, 1.68, -0.25), Color(0.65, 0.55, 0.3))
			else:
				for i in range(5):
					var angle: float = float(i) * TAU / 5.0
					var crystal = add_box(Vector3(0.22, 0.55, 0.2), Vector3(cos(angle) * 0.7, 3.55, sin(angle) * 0.7), Color(0.7, 0.48, 0.9))
					crystal.rotation.z = angle * 0.25
		2:
			add_box(Vector3(1.15, 0.95, 1.8), Vector3(0, 1.3, 0), color)
			for x in [-0.44, 0.44]:
				for z in [-0.55, 0.55]:
					add_box(Vector3(0.3, 1.1, 0.4), Vector3(x, 0.55, z), color.darkened(0.12))
			add_box(Vector3(0.65, 0.7, 1.1), Vector3(0, 1.55, -1.1), color)
			add_box(Vector3(0.58, 0.25, 0.7), Vector3(0, 1.25, -1.55), Color(0.95, 0.38, 0.1))
			for side in [-1.0, 1.0]:
				var wing = add_box(Vector3(0.8, 0.1, 1.4), Vector3(side * 0.96, 1.9, 0.1), color.darkened(0.3))
				wing.rotation.z = side * 0.35
				var horn = add_box(Vector3(0.15, 0.6, 0.15), Vector3(side * 0.24, 2.1, -1.0), Color(0.6, 0.52, 0.33))
				horn.rotation.x = 0.4
			add_box(Vector3(0.25, 0.25, 1.3), Vector3(0, 0.85, 1.35), color)
		3:
			add_sphere(0.65, Vector3(0, 1.85, 0), color)
			add_sphere(0.36, Vector3(0, 2.75, -0.28), color.lightened(0.14))
			add_box(Vector3(0.2, 0.2, 0.45), Vector3(0, 2.69, -0.6), Color(0.85, 0.64, 0.22))
			for side in [-1.0, 1.0]:
				var wing = add_box(Vector3(0.9, 0.14, 1.0), Vector3(side * 0.98, 2.2, 0), color.lightened(0.12))
				wing.rotation.z = side * 0.22
				for i in range(3):
					add_box(Vector3(0.13, 0.1, 0.65), Vector3(side * (1.15 + float(i) * 0.14), 2.18, 0.55), color)
				add_box(Vector3(0.18, 0.8, 0.18), Vector3(side * 0.28, 0.7, 0), Color(0.7, 0.55, 0.25))
				add_box(Vector3(0.4, 0.12, 0.55), Vector3(side * 0.28, 0.28, -0.2), Color(0.7, 0.55, 0.25))
			add_box(Vector3(0.65, 0.12, 1.0), Vector3(0, 1.32, 0.85), color)

func choose_attack() -> Dictionary:
	_attack_index += 1
	var distance: float = global_position.distance_to(director.player.global_position)
	var pattern: String = "melee"
	var data: Dictionary = {"damage": 24.0, "range": 2.7, "tell": 0.8, "recovery": 1.1, "duration": 0.2}
	match floor_index:
		0:
			pattern = "charge" if distance > 4.0 else ("slam" if _attack_index % 2 == 0 else "melee")
			data.merge({"range": 3.4 if pattern == "slam" else 2.8, "tell": 1.0, "speed": 7.0, "duration": 0.85 if pattern == "charge" else 0.2, "recovery": 1.35}, true)
		1:
			pattern = "fan" if distance > 3.8 else ("slam" if _attack_index % 2 == 0 else "melee")
			data.merge({"damage": 17.0 if pattern == "fan" else 23.0, "range": 3.8 if pattern == "slam" else 2.7, "tell": 1.0, "shots": 3, "projectile_speed": 7.0, "recovery": 1.25}, true)
		2:
			pattern = "breath" if distance > 3.4 else ("slam" if _attack_index % 3 == 0 else "melee")
			data.merge({"damage": 12.0 if pattern == "breath" else 27.0, "range": 3.1, "tell": 1.1, "duration": 0.85 if pattern == "breath" else 0.2, "recovery": 1.4}, true)
		3:
			pattern = "dive" if distance > 4.0 else ("fan" if _attack_index % 2 == 0 else "melee")
			data.merge({"damage": 25.0 if pattern == "dive" else 17.0, "tell": 0.85, "speed": 8.0, "duration": 0.7, "shots": 3, "projectile_speed": 10.0, "recovery": 1.4}, true)
		4:
			pattern = "blink" if _attack_index % 3 == 0 else ("fan" if distance > 3.4 else "slam")
			data.merge({"damage": 18.0 if pattern == "fan" else 26.0, "range": 3.4, "tell": 0.95, "shots": 5, "projectile_speed": 9.0, "recovery": 1.35}, true)
	if hp < max_hp * 0.5:
		data["tell"] = maxf(0.6, float(data["tell"]) * 0.85)
		data["recovery"] = maxf(0.9, float(data["recovery"]) * 0.9)
	data["pattern"] = pattern
	return data
