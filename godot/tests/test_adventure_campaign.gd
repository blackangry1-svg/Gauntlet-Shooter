extends SceneTree

const StateScript = preload("res:/" + "/scripts/adventure_state.gd")
const PlayerScript = preload("res:/" + "/scripts/adventure_player.gd")
const WorldScript = preload("res:/" + "/scripts/adventure_world.gd")
const DirectorScript = preload("res:/" + "/scripts/adventure_director.gd")
const MainScript = preload("res:/" + "/scripts/adventure_main.gd")
var state: Node
var world: Node3D
var actor: CharacterBody3D
var director: Node3D
var stage: Node3D
var passed: int = 0
var failed: int = 0
var travels: Array[int] = []

func _initialize() -> void:
	call_deferred("_run")

func _check(label: String, condition: bool) -> void:
	if condition:
		passed += 1
		print("PASS: " + label)
	else:
		failed += 1
		push_error("FAIL: " + label)

func _feature(id: String) -> Node:
	var result: Node = world.get_feature(id)
	if result == null:
		_check("feature exists: " + id, false)
	return result

func _load(index: int) -> void:
	_check("earned travel to floor " + str(index + 1), state.change_floor(index))
	world.load_floor(index)
	actor.cancel_combat()
	actor.set_diving(false)
	actor.global_position = world.get_spawn_position()
	actor.rotation.y = world.get_spawn_yaw()
	director.load_floor(index)
	director.set_physics_process(false)
	for enemy: Node in director.get_children():
		if enemy is CharacterBody3D:
			enemy.set_physics_process(false)
	await physics_frame
	await physics_frame

func _open_key_gate() -> void:
	var gate: Node = _feature("key_gate")
	_check("closed key gate blocks physics", gate.collision_layer == 9)
	gate.interact(actor)
	_check("key gate rejects missing key", not state.has_flag(world.current_floor, "gate_open"))
	_feature("floor_key").interact(actor)
	gate.interact(actor)
	await physics_frame
	_check("real floor key opens persistent physical gate", state.has_flag(world.current_floor, "key_collected") and state.has_flag(world.current_floor, "gate_open") and gate.collision_layer == 0)

func _defeat_guardian(index: int) -> void:
	var guardian: Node = director.boss
	_check("actual stage guardian exists", is_instance_valid(guardian))
	if is_instance_valid(guardian):
		guardian.take_damage(100000.0, 1.0, actor.global_position)
	_check("guardian death callback commits persistent victory", state.has_flag(index, "boss_defeated"))
	await physics_frame


func _freeze_main(game: Node) -> void:
	game.player.set_physics_process(false)
	game.world.set_physics_process(false)
	game.director.set_physics_process(false)
	for enemy: Node in game.director.get_children():
		if enemy is CharacterBody3D:
			enemy.set_physics_process(false)

func _test_main_transitions() -> void:
	var shared: Node = root.get_node("Adventure")
	var original_snapshot: Dictionary = shared.export_snapshot()
	var original_path: String = shared.save_path
	var original_autosave: bool = shared.auto_save_enabled
	shared.auto_save_enabled = false
	shared.save_path = ProjectSettings.globalize_path("res:/" + "/../.codex-local/validation/adventure-contracts/main-transitions.json")
	shared.new_game()
	shared.defeat_boss(0)
	shared.award_combat_reward(0, 1100)
	shared.level_up("strength")
	shared.level_up("strength")
	shared.level_up("dexterity")
	shared.level_up("focus")
	shared.change_floor(1)
	var game: Node3D = MainScript.new()
	root.add_child(game)
	current_scene = game
	_freeze_main(game)
	await physics_frame
	await physics_frame
	_check("real main HUD identifies Water", game.hud.title.text.begins_with("2 / 5"))
	game.world.get_feature("checkpoint").interact(game.player)
	game.hud._close_refuge()
	var checkpoint_position: Vector3 = game.world.cell_to_world(shared.checkpoint_cell) + Vector3(0, 0.08, 0)
	game.world.get_feature("dive_station").interact(game.player)
	_check("main scene enters real underwater environment", game.player.is_diving and game.player.camera.environment != null and game.player.global_position.y < -2.0)
	game.player.take_damage(10000.0, game.player.global_position + Vector3.RIGHT)
	await create_timer(1.45).timeout
	_freeze_main(game)
	_check("same-floor underwater death restores dry full-health player", not game.player._dead and not game.player.is_diving and game.player.hp == game.player.max_hp and game.player.camera.environment == null)
	_check("same-floor death returns to actual checkpoint", game.world.current_floor == 1 and game.player.global_position.distance_to(checkpoint_position) < 0.01 and shared.has_item("tide_charm"))
	shared.set_checkpoint(0, Vector2i(1, 1))
	shared.set_flag(1, "key_collected")
	game.player.cancel_combat()
	game.world.get_feature("dive_station").interact(game.player)
	game.player.take_damage(10000.0, game.player.global_position + Vector3.RIGHT)
	await create_timer(1.45).timeout
	_freeze_main(game)
	_check("cross-floor underwater death waits for actual rebuilt checkpoint floor", shared.current_floor == 0 and game.world.current_floor == 0 and not game.player._dead and game.player.global_position.distance_to(game.world.cell_to_world(shared.checkpoint_cell) + Vector3(0, 0.08, 0)) < 0.01)
	_check("cross-floor death clears tint and updates real HUD without losing milestones", game.player.camera.environment == null and not game.player.is_diving and game.hud.title.text.begins_with("1 / 5") and shared.has_flag(1, "key_collected") and shared.has_flag(0, "boss_defeated") and shared.has_item("bow"))
	game.world.get_feature("weapon_chest").interact(game.player)
	game.player.hp = 64.0
	game.world.get_feature("merchant").interact(game.player)
	game.world.get_feature("merchant").interact(game.player)
	_check("actual smith interaction opens real paused merchant panel", game.hud.shop.visible and paused)
	var purchase_balance: int = shared.souls
	var purchase_cost: int = shared.upgrade_cost("buckler")
	game.hud._buy_upgrade("buckler")
	_check("real merchant button flow upgrades buckler and spends exact cost without healing", shared.tool_level("buckler") == 2 and shared.souls == purchase_balance - purchase_cost and game.player.hp == 64.0)
	game.hud._close_shop()
	_check("closing real merchant panel resumes journey", not game.hud.shop.visible and not paused)
	var quality_input_before: int = Input.mouse_mode
	game.hud._toggle_pause()
	game.hud.quality_button.pressed.emit()
	var native_quality_ok: bool = Engine.max_fps == 60 and is_equal_approx(game.get_viewport().scaling_3d_scale, 1.0) and game.hud.quality_button.text.contains("native") and paused and game.hud.menu.visible and Input.mouse_mode == Input.MOUSE_MODE_VISIBLE
	game.hud.quality_button.pressed.emit()
	var low_power_quality_ok: bool = Engine.max_fps == 45 and is_equal_approx(game.get_viewport().scaling_3d_scale, 0.6) and game.hud.quality_button.text.contains("low power") and paused and game.hud.menu.visible and Input.mouse_mode == Input.MOUSE_MODE_VISIBLE
	game.hud.quality_button.pressed.emit()
	var balanced_quality_ok: bool = Engine.max_fps == 60 and is_equal_approx(game.get_viewport().scaling_3d_scale, 0.75) and game.hud.quality_button.text.contains("75%, 60 FPS") and paused and game.hud.menu.visible and Input.mouse_mode == Input.MOUSE_MODE_VISIBLE
	game.hud._toggle_pause()
	_check("real quality button cycles native low-power balanced while preserving pause and input", native_quality_ok and low_power_quality_ok and balanced_quality_ok and not paused and not game.hud.menu.visible and Input.mouse_mode == quality_input_before)
	var stable_map_cell: Vector2i = game.world.world_to_cell(game.player.global_position)
	game.hud.discoveries[shared.current_floor] = {}
	game.hud.last_cell = Vector2i(-99, -99)
	game.hud._update_map()
	_check("unowned sight reveals only base radius two", game.hud.map_reveal_radius() == 2 and game.hud.discoveries[shared.current_floor].has(stable_map_cell + Vector2i(2, 0)) and not game.hud.discoveries[shared.current_floor].has(stable_map_cell + Vector2i(3, 0)))
	shared.acquire_item("aether_sight")
	game.hud._update_map()
	_check("owned sight reveals radius three without moving player", game.hud.map_reveal_radius() == 3 and game.hud.last_cell == stable_map_cell and game.hud.discoveries[shared.current_floor].has(stable_map_cell + Vector2i(3, 0)) and not game.hud.discoveries[shared.current_floor].has(stable_map_cell + Vector2i(4, 0)))
	shared.souls = 75
	var sight_second: bool = shared.upgrade_tool("aether_sight")
	game.hud._update_map()
	_check("sight tier two reveals radius four at same player cell", sight_second and game.hud.map_reveal_radius() == 4 and game.hud.last_cell == stable_map_cell and game.hud.discoveries[shared.current_floor].has(stable_map_cell + Vector2i(4, 0)) and not game.hud.discoveries[shared.current_floor].has(stable_map_cell + Vector2i(5, 0)))
	var sight_third: bool = shared.upgrade_tool("aether_sight")
	game.hud._update_map()
	_check("sight tier three reveals radius five at same player cell", sight_third and game.hud.map_reveal_radius() == 5 and game.hud.last_cell == stable_map_cell and game.hud.discoveries[shared.current_floor].has(stable_map_cell + Vector2i(5, 0)))
	var transition_path: String = shared.save_path
	shared.save_path = ""
	_check("real HUD exposes failed save and leaves journey open", not game.hud._save_journey() and game.hud.save_status.text.begins_with("Save failed.") and game.is_inside_tree())
	shared.save_path = transition_path
	shared.change_floor(1)
	await physics_frame
	await physics_frame
	_freeze_main(game)
	game.player.hp = 73.0
	game.player.stamina = 51.0
	shared.equip_weapon("bow")
	game.player.cancel_combat()
	game.world.get_feature("dive_station").interact(game.player)
	_check("travel regression starts with pending real bow attack", game.player.attempt_attack() and not game.player._pending_attack.is_empty())
	var stamina_after_attack: float = game.player.stamina
	game._travel(0)
	await physics_frame
	await physics_frame
	_freeze_main(game)
	_check("floor travel clears underwater environment and pending combat", shared.current_floor == 0 and game.world.current_floor == 0 and game.player.camera.environment == null and not game.player.is_diving and game.player._pending_attack.is_empty() and not game.player.is_attacking and game.player.velocity == Vector3.ZERO)
	_check("floor travel updates HUD while preserving health and stamina", game.hud.title.text.begins_with("1 / 5") and game.player.hp == 73.0 and game.player.stamina == stamina_after_attack)

	var refuge_input_before: int = Input.mouse_mode
	shared.new_game()
	shared.acquire_item("sword")
	shared.award_combat_reward(0, 80)
	game.player.hp = 51.0
	game.player.stamina = 37.0
	game.world.get_feature("checkpoint").interact(game.player)
	_check("actual checkpoint opens paused refuge with level choice", paused and game.hud.refuge.visible and game.hud.refuge_summary.text.contains("LEVEL 1") and not game.hud.refuge_buttons["strength"].disabled and Input.mouse_mode == Input.MOUSE_MODE_VISIBLE)
	game.hud.refuge_buttons["strength"].pressed.emit()
	_check("actual refuge strength button spends80XP and heals upgraded capacity", shared.hero_level == 2 and shared.experience == 0 and shared.attribute_value("strength") == 6 and game.player.max_hp == 126.0 and game.player.hp == 126.0 and game.player.max_stamina == 102.0 and game.player.stamina == 102.0 and game.hud.refuge_summary.text.contains("LEVEL 2") and game.hud.refuge_buttons["strength"].disabled)
	_check("refuge unlock is reflected by real weapon equip contract", shared.equip_weapon("sword") and shared.equipped_weapon == "sword")
	game.hud._close_refuge()
	_check("refuge return resumes game and restores observed mouse mode", not paused and not game.hud.refuge.visible and Input.mouse_mode == refuge_input_before)
	current_scene = null
	game.queue_free()
	await physics_frame
	await physics_frame
	shared.save_path = original_path
	_check("transition fixture restores isolated autoload snapshot", shared.restore_snapshot(original_snapshot))
	shared.auto_save_enabled = original_autosave

func _run() -> void:
	stage = Node3D.new()
	root.add_child(stage)
	current_scene = stage
	state = StateScript.new()
	state.auto_save_enabled = false
	state.save_path = ProjectSettings.globalize_path("res:/" + "/../.codex-local/validation/adventure-contracts/campaign-progress.json")
	state.new_game()
	world = WorldScript.new()
	world.configure(state)
	stage.add_child(world)
	world.set_physics_process(false)
	world.travel_requested.connect(func(index: int): travels.append(index))
	actor = PlayerScript.new()
	actor.configure(state)
	stage.add_child(actor)
	actor.set_physics_process(false)
	director = DirectorScript.new()
	director.configure(state, world, actor)
	stage.add_child(director)
	director.set_physics_process(false)

	world.load_floor(1)
	actor.global_position = world.get_spawn_position()
	await physics_frame
	await physics_frame
	var before_dive: Vector3 = actor.global_position
	_feature("dive_station").interact(actor)
	_feature("floor_key").interact(actor)
	_check("Water dive and submerged key reject hero without charm", not actor.is_diving and actor.global_position == before_dive and not state.has_flag(1, "key_collected"))

	await _load(0)
	_check("campaign starts on shoreline with driftwood", state.equipped_weapon == "driftwood" and not state.has_item("sword"))
	_feature("weapon_chest").interact(actor)
	_check("actual shoreline chest grants sword and buckler", state.has_item("sword") and state.has_item("buckler") and state.has_flag(0, "weapon_chest"))
	await _open_key_gate()
	_feature("return_lever").interact(actor)
	_check("far-side lever opens physical return gate", state.has_flag(0, "shortcut_open") and _feature("shortcut_gate").collision_layer == 0)
	_feature("sun_roots").hit_weapon("staff")
	_check("Earth seal rejects absent staff", not state.has_item("sun_seal"))
	travels.clear()
	_feature("guardian_exit").interact(actor)
	_check("guardian exit rejects living boss", travels.is_empty())
	await _defeat_guardian(0)
	_check("Earth victory grants actual next-floor tools", state.has_item("bow") and state.has_item("tide_charm"))
	_feature("guardian_exit").interact(actor)
	_check("guardian exit requests unlocked Water travel", travels == [1])
	state.award_combat_reward(0, 1100)
	state.level_up("strength")
	state.level_up("strength")
	state.level_up("dexterity")
	state.level_up("focus")
	state.equip_weapon("sword")
	_feature("merchant").interact(actor)
	var level_before: int = state.tool_level("sword")
	var currency_before: int = state.souls
	actor.hp = 61.0
	_feature("merchant").interact(actor)
	_check("freed smith upgrades earned weapon using boss currency", state.has_flag(0, "merchant_free") and state.tool_level("sword") == level_before + 1 and state.souls < currency_before and actor.hp == 61.0)
	state.arrows = 0
	_feature("checkpoint").interact(actor)
	_check("actual checkpoint heals and restocks owned bow", actor.hp == actor.max_hp and state.arrows >= 10 and state.checkpoint_floor == 0)

	await _load(1)
	var original_environment: Environment = actor.camera.environment
	_feature("dive_station").interact(actor)
	_check("charm opens real submerged depth and underwater camera", actor.is_diving and actor.global_position.y < -2.0 and actor.camera.environment != original_environment)
	_feature("floor_key").interact(actor)
	_check("submerged key is obtainable while diving", state.has_flag(1, "key_collected"))
	_feature("return_bubble").interact(actor)
	_check("return bubbles restore dry depth and camera", not actor.is_diving and actor.global_position.y > 0.0 and actor.camera.environment == original_environment)
	_feature("key_gate").interact(actor)
	_check("submerged key releases Water gate", state.has_flag(1, "gate_open") and _feature("key_gate").collision_layer == 0)
	await _defeat_guardian(1)
	_check("Water victory grants staff and fire protection", state.has_item("staff") and state.has_item("ember_sigil") and state.staff_charges > 0)
	await _load(0)
	_feature("sun_roots").hit_weapon("staff")
	_check("Sun seal remains hidden until Air reveals aether sight", not state.has_item("sun_seal"))

	await _load(2)
	_check("raised bridge lacks a physical deck", world.bridge_deck.collision_layer == 0 and not world.bridge_visual.visible)
	_feature("bridge_lever").hit_weapon("sword")
	_check("Fire mechanism rejects wrong weapon", not state.has_flag(2, "bridge_lowered"))
	_feature("bridge_lever").hit_weapon("bow")
	await physics_frame
	_check("bow mechanism lowers visible collidable lava bridge", state.has_flag(2, "bridge_lowered") and world.bridge_deck.collision_layer == 1 and world.bridge_visual.visible and _feature("lava_bridge").collision_layer == 0)
	await _open_key_gate()
	_feature("moon_grate").hit_weapon("sword")
	_check("Moon grate rejects wrong weapon", not state.has_item("moon_seal"))
	await _defeat_guardian(2)
	_check("Fire victory grants spear and gale mantle", state.has_item("spear") and state.has_item("gale_mantle"))

	await _load(3)
	_feature("wind_barrier").interact(actor)
	var wind_flag: String = str(_feature("wind_barrier").data["flag"])
	_check("gale mantle opens actual wind obstacle", state.has_flag(3, wind_flag) and _feature("wind_barrier").collision_layer == 0)
	await _open_key_gate()
	await _defeat_guardian(3)
	_check("Air victory reveals sight while final floor stays sealed", state.has_item("aether_sight") and not state.can_travel_to(4))

	await _load(0)
	_check("revisiting Earth preserves chest gate shortcut and boss", state.has_flag(0, "weapon_chest") and _feature("weapon_chest").collision_layer == 0 and _feature("key_gate").collision_layer == 0 and _feature("shortcut_gate").collision_layer == 0 and director.boss == null)
	_feature("sun_roots").hit_weapon("bow")
	_check("revealed roots still require staff", not state.has_item("sun_seal"))
	_feature("sun_roots").hit_weapon("staff")
	_check("staff backtracking yields persistent Sun seal", state.has_item("sun_seal") and state.has_flag(0, "sun_secret") and not state.can_travel_to(4))

	await _load(2)
	_check("Fire bridge remains lowered on revisit", world.bridge_deck.collision_layer == 1 and world.bridge_visual.visible)
	_feature("moon_grate").hit_weapon("spear")
	_check("spear backtracking yields Moon seal and final access", state.has_item("moon_seal") and state.has_flag(2, "moon_secret") and state.can_travel_to(4))

	await _load(4)
	_feature("arcane_barrier").interact(actor)
	var arcane_flag: String = str(_feature("arcane_barrier").data["flag"])
	_check("aether sight opens final actual arcane obstacle", state.has_flag(4, arcane_flag) and _feature("arcane_barrier").collision_layer == 0)
	await _open_key_gate()
	await _defeat_guardian(4)
	_check("complete real guardian chain releases tower heart", state.has_item("tower_heart"))
	_check("full campaign milestones save", state.save_game())
	var reloaded: Node = StateScript.new()
	reloaded.auto_save_enabled = false
	reloaded.save_path = state.save_path
	_check("reloaded campaign preserves completion and revisit topology", reloaded.load_game() and reloaded.has_item("tower_heart") and reloaded.has_item("sun_seal") and reloaded.has_item("moon_seal") and reloaded.has_flag(0, "shortcut_open") and reloaded.has_flag(2, "bridge_lowered") and reloaded.has_flag(4, "gate_open"))
	reloaded.free()
	stage.queue_free()
	await physics_frame
	await physics_frame
	state.free()
	await _test_main_transitions()
	print("ADVENTURE CAMPAIGN RESULTS: " + str(passed) + " passed; " + str(failed) + " failed")
	quit(0 if failed == 0 else 1)
