extends SceneTree

var output_dir: String
var reports: Array = []
var game
var state
var failures: int = 0
var low_power: bool = false

func _initialize() -> void:
	call_deferred("_run")

func check(condition: bool, label: String) -> void:
	if not condition:
		failures += 1
		push_error(label)
	print(("PASS " if condition else "FAIL ") + label)

func _run() -> void:
	low_power = "--adventure-low-power" in OS.get_cmdline_user_args()
	output_dir = ProjectSettings.globalize_path("res:/" + "/../.codex-local/overhaul/render")
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--capture-dir="):
			output_dir = argument.trim_prefix("--capture-dir=")
	DirAccess.make_dir_recursive_absolute(output_dir)
	state = root.get_node("Adventure")
	check(state.save_path.contains(".codex-local"), "capture uses isolated adventure save")
	state.new_game()
	game = load("res:/" + "/scripts/adventure_main.gd").new()
	root.add_child(game)
	current_scene = game
	await process_frame
	await physics_frame
	await physics_frame
	if low_power:
		game.hud._cycle_quality()
		game.hud._cycle_quality()
		check(Engine.max_fps == 45 and is_equal_approx(root.scaling_3d_scale, 0.6), "low power applies45FPS and60percent rendering")
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	check(game.player.state == state, "single hero shares adventure state")
	check(not state.has_item("bow") and state.has_item("driftwood"), "shore starts with driftwood only")
	await _capture("00_shore")
	for item: String in ["sword", "buckler", "bow", "staff", "spear", "tide_charm", "ember_sigil", "gale_mantle", "aether_sight", "sun_seal", "moon_seal"]:
		state.acquire_item(item)
	state.add_ammo("bow", 30)
	state.add_ammo("staff", 12)
	for index: int in range(1 if low_power else 5):
		state.current_floor = index
		state.set_flag(index, "hidden_guardian_awake", true)
		game.world.load_floor(index)
		await process_frame
		await physics_frame
		await physics_frame
		game.player.hp = game.player.max_hp
		game.hud.refresh_floor()
		check(game.world.get_map_data().grid.size() == 31, "floor%d contains31-row maze" % index)
		check(game.director.active_enemy_count() <= 8, "floor%d bounded actor count" % index)
		await _capture("%02d_corridor" % (index + 1))
		if index == 1:
			game.world.get_feature("dive_station").interact(game.player)
			await physics_frame
			await physics_frame
			await _capture("02_underwater")
			game.world.get_feature("return_bubble").interact(game.player)
			await physics_frame
		if index == 2:
			game.world.get_feature("floor_key").interact(game.player)
			game.world.get_feature("key_gate").interact(game.player)
			game.world.get_feature("bridge_lever").hit_weapon("bow")
			var bridge: Node = game.world.get_feature("lava_bridge")
			var bridge_cell: Vector2i = game.world.world_to_cell(bridge.global_position)
			for direction: Vector2i in [Vector2i(0, 1), Vector2i(0, -1), Vector2i(1, 0), Vector2i(-1, 0)]:
				if game.world.is_walkable(bridge_cell + direction):
					game.player.global_position = game.world.cell_to_world(bridge_cell + direction) + Vector3(0, 0.1, 0)
					game.player.look_at(Vector3(bridge.global_position.x, game.player.global_position.y, bridge.global_position.z), Vector3.UP)
					game.player.camera.rotation.x = -0.28
					break
			await physics_frame
			await _capture("03_lava_bridge")
		var spec: Dictionary = game.world.get_floor_spec(index)
		var boss_pos: Vector3 = spec.get("boss_spawn", game.player.position)
		var boss_cell: Vector2i = game.world.world_to_cell(boss_pos)
		var chosen: Vector2i = boss_cell
		var best_score: float = INF
		for y: int in range(-4, 5):
			for x: int in range(-4, 5):
				var candidate: Vector2i = boss_cell + Vector2i(x, y)
				if not game.world.is_walkable(candidate):
					continue
				var origin: Vector3 = game.world.cell_to_world(candidate) + Vector3(0, 1.65, 0)
				var distance: float = origin.distance_to(boss_pos + Vector3(0, 1.65, 0))
				if distance < 5.0 or distance > 12.0:
					continue
				var query := PhysicsRayQueryParameters3D.create(origin, boss_pos + Vector3(0, 1.65, 0), 1)
				if not game.world.get_world_3d().direct_space_state.intersect_ray(query).is_empty():
					continue
				var score: float = absf(distance - 7.5)
				if score < best_score:
					chosen = candidate
					best_score = score
		if chosen == boss_cell:
			for offset: Vector2i in [Vector2i(0, 1), Vector2i(0, -1), Vector2i(1, 0), Vector2i(-1, 0)]:
				if game.world.is_walkable(boss_cell + offset):
					chosen = boss_cell + offset
					break
		game.player.global_position = game.world.cell_to_world(chosen) + Vector3(0, 0.1, 0)
		game.player.velocity = Vector3.ZERO
		var look_target: Vector3 = boss_pos + Vector3(0, 1.6, 0)
		if game.player.global_position.distance_squared_to(look_target) > 0.1:
			game.player.look_at(Vector3(look_target.x, game.player.global_position.y, look_target.z), Vector3.UP)
			game.player.camera.rotation.x = -0.04
		await create_timer(0.1).timeout
		game.player.hp = game.player.max_hp
		await _capture("%02d_boss" % (index + 1))
		await _sample(index)
	game.hud.show_merchant()
	await _capture("08_merchant")
	game.hud._close_shop()
	game.hud._toggle_pause()
	await _capture("06_pause")
	game.hud._toggle_pause()
	game.hud.journal.visible = true
	await _capture("07_journal")
	game.hud.journal.visible = false
	var file := FileAccess.open(output_dir.path_join("render_performance.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify({"schema": 1, "render_driver": ProjectSettings.get_setting("rendering/renderer/rendering_method"), "render_scale": root.scaling_3d_scale, "frame_cap": Engine.max_fps, "low_power": low_power, "window": str(root.size), "failures": failures, "floors": reports, "note": "Scripted local rendering and bounded combat sample; physical user input not certified."}, "\t"))
	file.close()
	print("RENDER_REPORT " + output_dir.path_join("render_performance.json"))
	quit(0 if failures == 0 else 1)

func _capture(id: String) -> void:
	await process_frame
	RenderingServer.force_draw()
	var pixels: Image = root.get_texture().get_image()
	check(not pixels.is_empty(), "render image " + id)
	pixels.save_png(output_dir.path_join(id + ".png"))

func _sample(index: int) -> void:
	game.director.stress_awake = true
	var samples: Array[float] = []
	var process_samples: Array[float] = []
	var physics_samples: Array[float] = []
	var last_tick: int = Time.get_ticks_usec()
	var max_draws: int = 0
	var max_nodes: int = 0
	var max_shots: int = 0
	for frame: int in range(360):
		game.player.hp = game.player.max_hp
		game.player.rotation.y += sin(float(frame) * 0.13) * 0.001
		if frame % 45 == 0:
			game.player.attempt_attack(false)
		await process_frame
		var tick: int = Time.get_ticks_usec()
		if frame >= 120:
			samples.append(float(tick - last_tick) / 1000.0)
			process_samples.append(Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0)
			physics_samples.append(Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0)
		last_tick = tick
		max_draws = maxi(max_draws, int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)))
		max_nodes = maxi(max_nodes, int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT)))
		max_shots = maxi(max_shots, game.director.projectile_count())
	samples.sort()
	process_samples.sort()
	physics_samples.sort()
	var result: Dictionary = {"floor": index, "frame_ms_median": samples[samples.size()/2], "frame_ms_p95": samples[int(samples.size()*0.95)], "process_ms_p95": process_samples[int(process_samples.size()*0.95)], "physics_ms_p95": physics_samples[int(physics_samples.size()*0.95)], "max_draw_calls": max_draws, "max_nodes": max_nodes, "max_hostile_projectiles": max_shots, "active_actors": game.director.active_enemy_count()}
	result["simulation"] = game.director.performance_counts()
	game.director.stress_awake = false
	reports.append(result)
	print("PERF " + JSON.stringify(result))
