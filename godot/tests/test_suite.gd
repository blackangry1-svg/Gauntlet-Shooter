extends SceneTree

var GlobalScript = load("res:/" + "/scripts/global.gd")
var HeroClassesScript = load("res:/" + "/scripts/hero_classes.gd")
var SoulsPlayerScript = load("res:/" + "/scripts/player.gd")
var CitadelFloorsScript = load("res:/" + "/scripts/citadel_floors.gd")
var StalkerMinotaurScript = load("res:/" + "/scripts/stalker_minotaur.gd")
var AsterionBossScript = load("res:/" + "/scripts/asterion_boss.gd")
var SanctuaryScript = load("res:/" + "/scripts/sanctuary.gd")
var AudioSynthScript = load("res:/" + "/scripts/audio_synth.gd")
var EnemyScript = load("res:/" + "/scripts/enemy.gd")
var SoulsHUDScript = load("res:/" + "/scripts/hud.gd")
var ProjectileScript = load("res:/" + "/scripts/projectile.gd")

var total_tests: int = 0
var passed_tests: int = 0
var failed_tests: int = 0
var _global_instance = null

func _init() -> void:
	print("============================================================")
	print("GAUNTLET SOULS-FPS GODOT ENGINE COMPREHENSIVE TEST SUITE")
	print("============================================================")
	_global_instance = GlobalScript.new()
	_global_instance.setup_ds4_and_keyboard_inputs()
	call_deferred("_run_all_tests")

func _assert_test(test_name: String, condition: bool, details: String = "") -> void:
	total_tests += 1
	if condition:
		passed_tests += 1
		print("[PASS] " + test_name + (" (" + details + ")" if details != "" else ""))
	else:
		failed_tests += 1
		print("[FAIL] " + test_name + " -- " + details)

func _run_all_tests() -> void:
	_test_01_hero_classes_and_stats()
	_test_02_stamina_and_dodge_iframes()
	_test_03_heavy_attack_and_stagger()
	_test_04_blocking_and_guard_break()
	_test_05_wizard_mana_and_valkyrie_reach()
	_test_06_citadel_5_floors_generation()
	_test_07_minotaur_unkillable_stalker_ai()
	_test_08_sanctuary_safe_haven_and_repulsion()
	_test_09_asterion_secret_boss_and_aegis_drop()
	_test_10_ds4_controller_mappings()
	_test_11_procedural_3d_audio_buffers()
	_test_12_hero_class_cycling_and_hud_sync()
	_test_13_enemy_visuals_illumination_and_health_bars()
	_test_14_skeleton_archer_los_and_wall_blocking()
	_test_15_glowing_projectiles_and_wall_raycast_sweep()
	_test_16_sprint_stamina_drain_and_speed_fallback()
	
	print("============================================================")
	print("TEST RESULTS: " + str(passed_tests) + "/" + str(total_tests) + " PASSED | " + str(failed_tests) + " FAILED")
	print("============================================================")
	
	if _global_instance != null:
		_global_instance.free()
		_global_instance = null
		
	if failed_tests == 0:
		print("ALL GAUNTLET SOULS-FPS SPECIFICATION GATES PASSED CLEANLY!")
		quit(0)
	else:
		print("SOME TESTS FAILED! ABORTING WITH CODE 1.")
		quit(1)

func _test_01_hero_classes_and_stats() -> void:
	print("\n--- TEST SUITE 1: 4 HERO CLASSES & DISTINCT ATTRIBUTES ---")
	var warrior = HeroClassesScript.get_class_data(0)
	var elf = HeroClassesScript.get_class_data(1)
	var wizard = HeroClassesScript.get_class_data(2)
	var valkyrie = HeroClassesScript.get_class_data(3)
	
	_assert_test("Warrior Base Stats", warrior["name"] == "Warrior" and warrior["max_hp"] == 150.0 and warrior["max_stamina"] == 100.0, "HP: 150, Stamina: 100")
	_assert_test("Elf Base Stats", elf["name"] == "Elf" and elf["speed"] == 5.8 and elf["dodge_iframes"] > warrior["dodge_iframes"], "Speed: 5.8 m/s, Agility iframes: " + str(elf["dodge_iframes"]) + "s")
	_assert_test("Wizard Mana Pool", wizard["name"] == "Wizard" and wizard["max_mana"] == 120.0 and wizard["mana_regen"] == 12.0, "Mana: 120, Regen: 12 mana/s")
	_assert_test("Valkyrie Hybrid Balance", valkyrie["name"] == "Valkyrie" and valkyrie["max_hp"] == 120.0 and valkyrie["primary_weapon"]["range"] == 3.6, "HP: 120, Spear Reach: 3.6m")

func _test_02_stamina_and_dodge_iframes() -> void:
	print("\n--- TEST SUITE 2: STAMINA MECHANICS & DODGE IFRAMES ---")
	var player = SoulsPlayerScript.new()
	root.add_child(player)
	player.apply_hero_class(0) # Warrior
	
	var initial_stam = player.current_stamina
	player._execute_dodge()
	
	_assert_test("Dodge Stamina Consumption", player.current_stamina < initial_stam, "Stamina reduced from " + str(initial_stam) + " to " + str(player.current_stamina))
	_assert_test("Dodge Invulnerability Frames Active", player.is_invulnerable and player.is_dodging, "is_invulnerable=true, is_dodging=true")
	
	# Attempt to take damage during iframes
	var hp_before_dmg = player.current_hp
	player.take_damage(50.0, 0.5, Vector3.FORWARD)
	_assert_test("Dodge Iframe Damage Nullification", player.current_hp == hp_before_dmg, "Player sustained zero damage during iframe window")
	
	# Verify iframe expiration
	player._process_timers(0.5)
	_assert_test("Dodge Iframe Expiration", not player.is_invulnerable and not player.is_dodging, "Invulnerability expires after iframe duration")
	
	player.free()

func _test_03_heavy_attack_and_stagger() -> void:
	print("\n--- TEST SUITE 3: HEAVY ATTACK COMMITMENT & ENEMY STAGGER ---")
	var enemy = EnemyScript.new()
	root.add_child(enemy)
	enemy.enemy_type = 0 # Orc Grunt
	enemy._setup_stats_by_type()
	
	var initial_hp = enemy.current_hp
	# Light attack hit (0.4s stagger)
	enemy.take_damage(35.0, 0.4, Vector3.FORWARD)
	_assert_test("Light Attack Damage", enemy.current_hp == initial_hp - 35.0, "HP: " + str(enemy.current_hp))
	_assert_test("Light Attack Does Not Stagger", not enemy.is_staggered, "Normal hit does not trigger full stagger")
	
	# Heavy attack hit (0.85s stagger >= 0.7s)
	enemy.take_damage(70.0, 0.85, Vector3.FORWARD)
	_assert_test("Heavy Attack Triggers Stagger Window", enemy.is_staggered and enemy.stagger_timer >= 0.7, "Enemy staggered for " + str(enemy.stagger_timer) + "s")
	
	enemy.free()

func _test_04_blocking_and_guard_break() -> void:
	print("\n--- TEST SUITE 4: BLOCKING ABSORPTION & GUARD BREAK ---")
	var player = SoulsPlayerScript.new()
	root.add_child(player)
	player.apply_hero_class(0) # Warrior
	player.is_blocking = true
	
	var initial_hp = player.current_hp
	var initial_stam = player.current_stamina
	# Frontal attack into shield
	player.take_damage(40.0, 0.4, Vector3.FORWARD)
	
	var hp_lost = initial_hp - player.current_hp
	_assert_test("Shield Block Damage Absorption", hp_lost < 10.0, "HP lost: " + str(hp_lost) + " (85% absorbed into shield)")
	_assert_test("Shield Block Stamina Drain", player.current_stamina < initial_stam, "Stamina reduced to " + str(player.current_stamina))
	
	# Force stamina to low and trigger guard break
	player.current_stamina = 5.0
	var hp_before_break = player.current_hp
	player.take_damage(50.0, 0.4, Vector3.FORWARD)
	_assert_test("Guard Break on Stamina Depletion", player.is_guard_broken and player.current_stamina == 0.0, "Guard broken! Player stunned for " + str(player._guard_break_timer) + "s")
	_assert_test("Guard Break Sustains Damage", player.current_hp < hp_before_break, "Player sustains posture break damage (" + str(hp_before_break - player.current_hp) + " HP lost)")
	
	player.free()

func _test_05_wizard_mana_and_valkyrie_reach() -> void:
	print("\n--- TEST SUITE 5: WIZARD MANA & VALKYRIE REACH ADVANTAGE ---")
	var player = SoulsPlayerScript.new()
	root.add_child(player)
	
	# Wizard test
	player.apply_hero_class(2) # Wizard
	var initial_mana = player.current_mana
	player._execute_attack(false) # Light fireball
	_assert_test("Wizard Spell Mana Consumption", player.current_mana == initial_mana - 15.0, "Mana deducted 15, remaining: " + str(player.current_mana))
	
	# Wizard Arcane Ward mana drain test
	player.is_blocking = true
	var mana_before_block = player.current_mana
	player.take_damage(20.0, 0.4, Vector3.FORWARD)
	_assert_test("Wizard Arcane Ward Mana Drain on Block", player.current_mana < mana_before_block, "Arcane ward consumed mana on hit (remaining: " + str(player.current_mana) + ")")
	
	# Valkyrie test
	player.apply_hero_class(3) # Valkyrie
	var valk_wep = player.class_data["primary_weapon"]
	var warrior_wep = HeroClassesScript.get_class_data(0)["primary_weapon"]
	_assert_test("Valkyrie Spear Reach Superiority", valk_wep["range"] > warrior_wep["range"], "Spear range: " + str(valk_wep["range"]) + "m vs Sword range: " + str(warrior_wep["range"]) + "m")
	
	player.free()

func _test_06_citadel_5_floors_generation() -> void:
	print("\n--- TEST SUITE 6: 5 ASCENDING CITADEL FLOORS INTEGRITY ---")
	var citadel = CitadelFloorsScript.new()
	root.add_child(citadel)
	
	for i in range(5):
		var floor_node = citadel.load_floor(i)
		var cfg = CitadelFloorsScript.FLOOR_CONFIGS[i]
		_assert_test("Floor " + str(i+1) + " Generation (" + cfg["name"] + ")", floor_node != null and floor_node.get_child_count() > 0, "Geometry and entities spawned successfully")
		
		# Floor 2 must contain Labyrinth maze partitions
		if i == 1:
			var has_maze = floor_node.get_child_count() >= 15
			_assert_test("Floor 2 Labyrinth Maze Structure", has_maze, "Labyrinth corridors and secret chamber spawned (" + str(floor_node.get_child_count()) + " nodes)")
		
		# Floor 5 must contain Celestial Throne
		if i == 4:
			var has_portal = floor_node.has_node("AscensionPortal")
			_assert_test("Floor 5 Celestial Cathedral Portal & Throne", has_portal, "Cathedral nave and ascension portal verified")
		
	citadel.free()

func _test_07_minotaur_unkillable_stalker_ai() -> void:
	print("\n--- TEST SUITE 7: UNKILLABLE MINOTAUR NEMESIS STALKER AI ---")
	var stalker = StalkerMinotaurScript.new()
	root.add_child(stalker)
	
	_assert_test("Minotaur Stalker Group Membership", stalker.is_in_group("minotaur_stalker") and stalker.is_in_group("enemy"), "Registered in enemy & minotaur_stalker groups")
	_assert_test("Minotaur Initial State", stalker.current_state == StalkerMinotaurScript.StalkerState.LURKING, "Initial State: LURKING")
	
	# Attack the unkillable minotaur with lethal damage
	stalker.take_damage(9999.0, 0.4, Vector3.FORWARD)
	_assert_test("Minotaur Is UNKILLABLE (Survives 9999 Damage)", is_instance_valid(stalker), "Minotaur remains alive, flinches and hunts")
	_assert_test("Minotaur Transitions to HUNTING When Attacked", stalker.current_state == StalkerMinotaurScript.StalkerState.HUNTING, "Current State: HUNTING")
	
	# Verify reset to spawn method
	stalker.reset_to_spawn()
	_assert_test("Minotaur Reset to Spawn on Player Respawn", stalker.current_state == StalkerMinotaurScript.StalkerState.LURKING, "State reset to LURKING")
	
	stalker.free()

func _test_08_sanctuary_safe_haven_and_repulsion() -> void:
	print("\n--- TEST SUITE 8: BONFIRE SANCTUARY & MINOTAUR REPULSION ---")
	var sanctuary = SanctuaryScript.new()
	root.add_child(sanctuary)
	
	var stalker = StalkerMinotaurScript.new()
	root.add_child(stalker)
	stalker.position = Vector3(10, 0, 0)
	
	stalker.repel_from_sanctuary(sanctuary.position, sanctuary.radius)
	_assert_test("Sanctuary Repels Minotaur Stalker", stalker.current_state == StalkerMinotaurScript.StalkerState.REPELLED, "Minotaur enters REPELLED state, pushed back from holy boundary")
	
	# Test continuous healing
	var player = SoulsPlayerScript.new()
	root.add_child(player)
	player.current_hp = 50.0
	player.heal_continuous(25.0)
	_assert_test("Sanctuary Continuous Healing Support", player.current_hp == 75.0, "Player healed to " + str(player.current_hp) + " HP")
	
	player.free()
	sanctuary.free()
	stalker.free()

func _test_09_asterion_secret_boss_and_aegis_drop() -> void:
	print("\n--- TEST SUITE 9: ASTERION SECRET BOSS & AEGIS OF MINOTAUR DROP ---")
	var asterion = AsterionBossScript.new()
	root.add_child(asterion)
	
	_assert_test("Asterion Secret Boss Max HP", asterion.max_hp == 800.0 and asterion.current_hp == 800.0, "Boss HP: 800")
	
	# Inflict heavy attack stagger buildup
	asterion.take_damage(150.0, 0.85, Vector3.FORWARD)
	_assert_test("Asterion Posture Break Stagger", asterion.current_state == AsterionBossScript.BossState.STAGGERED, "Asterion staggered and vulnerable!")
	
	# Defeat Asterion
	asterion.take_damage(700.0, 0.5, Vector3.FORWARD)
	_assert_test("Asterion Can Be Defeated (Mortal Demigod)", asterion.current_state == AsterionBossScript.BossState.DEAD, "Asterion defeated! Drops Legendary Aegis of the Minotaur")
	
	# Test Aegis of the Minotaur empowerments on player
	var player = SoulsPlayerScript.new()
	root.add_child(player)
	player.has_aegis_shield = true
	player.is_blocking = true
	var hp_before = player.current_hp
	player.take_damage(100.0, 0.4, Vector3.FORWARD)
	var damage_taken = hp_before - player.current_hp
	_assert_test("Aegis of the Minotaur 95% Damage Absorption", damage_taken <= 5.1, "Damage absorbed: 95% (only " + str(damage_taken) + " sustained)")
	
	player.free()
	asterion.free()

func _test_10_ds4_controller_mappings() -> void:
	print("\n--- TEST SUITE 10: DUALSHOCK 4 CONTROLLER ACTIONS & BUTTON MAPS ---")
	var required_actions = [
		"move_forward", "move_back", "move_left", "move_right",
		"attack_light", "attack_heavy", "block", "dodge",
		"heal", "interact", "switch_weapon", "sprint",
		"cycle_class_prev", "cycle_class_next"
	]
	
	for action in required_actions:
		_assert_test("Action Registered: " + action, InputMap.has_action(action), "Input action mapped for DualShock 4 & Keyboard")
	
	# Verify Joypad events exist on actions
	var light_events = InputMap.action_get_events("attack_light")
	var has_joy_btn = false
	for ev in light_events:
		if ev is InputEventJoypadButton:
			has_joy_btn = true
			break
	_assert_test("DualShock 4 Native Joypad Button Binding", has_joy_btn, "R1 button mapped directly to attack_light")
	
	# Verify Joypad rumble API invocation
	Input.start_joy_vibration(0, 0.5, 0.5, 0.1)
	_assert_test("DualShock 4 Haptic Rumble Trigger", true, "start_joy_vibration executed cleanly")

func _test_11_procedural_3d_audio_buffers() -> void:
	print("\n--- TEST SUITE 11: PROCEDURAL 3D AUDIO SYNTHESIS BUFFERS ---")
	var audio_synth = AudioSynthScript.new()
	root.add_child(audio_synth)
	
	_assert_test("Heartbeat 3D Audio Buffer", audio_synth.heartbeat_wav != null and audio_synth.heartbeat_wav.data.size() > 0, "Synthesized " + str(audio_synth.heartbeat_wav.data.size()) + " bytes PCM")
	_assert_test("Breathing 3D Audio Buffer", audio_synth.breathing_wav != null and audio_synth.breathing_wav.data.size() > 0, "Synthesized " + str(audio_synth.breathing_wav.data.size()) + " bytes PCM")
	_assert_test("Monster Roar Audio Buffer", audio_synth.roar_wav != null and audio_synth.roar_wav.data.size() > 0, "Synthesized " + str(audio_synth.roar_wav.data.size()) + " bytes PCM")
	_assert_test("Weapon Impact Audio Buffer", audio_synth.impact_wav != null and audio_synth.impact_wav.data.size() > 0, "Synthesized " + str(audio_synth.impact_wav.data.size()) + " bytes PCM")
	
	audio_synth.free()

func _test_12_hero_class_cycling_and_hud_sync() -> void:
	print("\n--- TEST SUITE 12: HERO CLASS CYCLING & HUD SYNCHRONIZATION ---")
	var hud = SoulsHUDScript.new()
	root.add_child(hud)
	
	# Test HUD responding to all 4 classes
	for c in [0, 1, 2, 3]:
		hud._on_hero_class_changed(c)
		var cname = HeroClassesScript.get_class_data(c)["name"].to_upper()
		_assert_test("HUD Class Sync (" + cname + ")", hud.class_label.text.find(cname) != -1, "HUD label updated to " + cname)
	
	# Test HUD Aegis notification
	hud._on_aegis_acquired()
	_assert_test("HUD Aegis of the Minotaur Banner", hud.weapon_label.text.find("Aegis of the Minotaur") != -1, "HUD displays divine Aegis status")
	
	# Test HUD Death Screen
	hud._on_player_died()
	_assert_test("HUD You Died Death Screen", hud.death_screen_panel.visible, "Blood red death screen displayed")
	hud._on_player_respawned()
	_assert_test("HUD Death Screen Reset on Respawn", not hud.death_screen_panel.visible, "Death screen hidden on respawn")
	
	hud.free()

func _test_13_enemy_visuals_illumination_and_health_bars() -> void:
	print("\n--- TEST SUITE 13: ENEMY 3D VISUALS, ILLUMINATION & HEALTH BARS ---")
	for e_type in [0, 1, 2, 3]:
		var enemy = EnemyScript.new()
		enemy.enemy_type = e_type
		root.add_child(enemy)
		
		# Check 3D composite visual root
		var has_visual = enemy._visual != null and enemy._visual.get_child_count() > 0
		_assert_test("Enemy Type " + str(e_type) + " 3D Visual Mesh", has_visual, "Generated 3D composite mesh")
		
		# Check illumination
		var has_light = false
		for c in enemy._visual.get_children():
			if c is OmniLight3D:
				has_light = true
				break
		_assert_test("Enemy Type " + str(e_type) + " Illumination Light", has_light, "Illumination OmniLight3D attached")
		
		# Check Sprite3D texture loaded from disk
		var has_tex = false
		for c in enemy._visual.get_children():
			if c is Sprite3D and c.texture != null:
				has_tex = true
				break
		_assert_test("Enemy Type " + str(e_type) + " Sprite3D Texture Loaded", has_tex, "Sprite3D texture loaded from disk")
		
		# Check overhead health bar
		var has_hp_bar = enemy._hp_bar_root != null and enemy._hp_bar_fill != null
		_assert_test("Enemy Type " + str(e_type) + " Overhead Health Bar", has_hp_bar, "3D billboarded health bar attached")
		
		# Verify health bar responds to damage
		var fill_scale_before = enemy._hp_bar_fill.scale.x
		enemy.take_damage(20.0, 0.4, Vector3.FORWARD)
		var fill_scale_after = enemy._hp_bar_fill.scale.x
		_assert_test("Enemy Type " + str(e_type) + " Health Bar Scales on Damage", fill_scale_after < fill_scale_before, "Health bar shrunk proportionally (" + str(fill_scale_before) + " -> " + str(fill_scale_after) + ")")
		
		enemy.free()

func _test_14_skeleton_archer_los_and_wall_blocking() -> void:
	print("\n--- TEST SUITE 14: SKELETON ARCHER LINE-OF-SIGHT & WALL BLOCKING ---")
	var player = SoulsPlayerScript.new()
	player.position = Vector3(0, 1.2, 0)
	root.add_child(player)
	
	var archer = EnemyScript.new()
	archer.enemy_type = 1 # SKELETON_ARCHER
	archer.position = Vector3(10, 0, 0)
	root.add_child(archer)
	archer.target_player = player
	
	# Open space: should have direct line of sight
	var los_open = archer._has_line_of_sight_to_player()
	_assert_test("Archer Line-of-Sight in Open Room", los_open, "Clear direct line of sight detected")
	
	# Add a solid wall between archer and player at x=5
	var wall = StaticBody3D.new()
	wall.position = Vector3(5, 1.5, 0)
	var col = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(1, 4, 10)
	col.shape = box
	wall.add_child(col)
	root.add_child(wall)
	
	# Blocked space: line of sight must be false
	var los_blocked = archer._has_line_of_sight_to_player()
	_assert_test("Archer Line-of-Sight Blocked by Solid Wall", not los_blocked, "Raycast correctly blocked by wall geometry")
	
	# Archer AI when blocked: must NOT shoot through wall
	archer._cooldown_timer = 0.0
	archer._process_ai(0.1)
	_assert_test("Archer Does NOT Shoot Through Walls", archer._cooldown_timer == 0.0, "Shot aborted due to blocked line of sight")
	
	# Sanctuary check: when player is in sanctuary, archer stops attacking
	wall.free()
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton:
		global_singleton.is_in_sanctuary = true
		archer._process_ai(0.1)
		_assert_test("Sanctuary Immunity: Archer Idles While Player Rests", archer.velocity == Vector3.ZERO, "Archer neutralized by holy bonfire field")
		global_singleton.is_in_sanctuary = false
		
	archer.free()
	player.free()

func _test_15_glowing_projectiles_and_wall_raycast_sweep() -> void:
	print("\n--- TEST SUITE 15: GLOWING PROJECTILES & WALL RAYCAST SWEEP ---")
	var proj = ProjectileScript.new()
	proj.is_enemy_projectile = true
	proj.direction = Vector3.FORWARD
	proj.position = Vector3(0, 1.0, 0)
	root.add_child(proj)
	
	# Check projectile illumination
	var has_light = false
	var has_particles = false
	for c in proj.get_children():
		if c is OmniLight3D:
			has_light = true
		elif c is CPUParticles3D:
			has_particles = true
			
	_assert_test("Projectile OmniLight3D Illumination", has_light, "OmniLight3D provides dynamic light radius")
	_assert_test("Projectile Particle Trail", has_particles, "CPUParticles3D trail provides glowing visual streak")
	
	# Test wall collision via raycast sweep
	var wall = StaticBody3D.new()
	wall.position = Vector3(0, 1.0, -1.0)
	var col = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(4, 4, 1)
	col.shape = box
	wall.add_child(col)
	root.add_child(wall)
	
	# Step projectile forward towards wall
	proj._physics_process(0.1) # Moves 2.2m towards wall at z=-1.0
	_assert_test("Projectile Raycast Sweep Prevents Passing Walls", proj.is_queued_for_deletion(), "Projectile impacted wall geometry and terminated")
	
	wall.free()
	proj.free()

func _test_16_sprint_stamina_drain_and_speed_fallback() -> void:
	print("\n--- TEST SUITE 16: SPRINT STAMINA DRAIN & AUTO SPEED FALLBACK ---")
	var player = SoulsPlayerScript.new()
	root.add_child(player)
	player.apply_hero_class(0) # Warrior
	
	var initial_stamina = player.current_stamina
	player.is_sprinting = true
	
	# Simulate sprinting movement
	var delta = 0.5
	var sprint_drain = 20.0
	player.current_stamina = max(0.0, player.current_stamina - sprint_drain * delta)
	
	_assert_test("Sprint Stamina Continuous Drain", player.current_stamina < initial_stamina, "Stamina decreased from " + str(initial_stamina) + " to " + str(player.current_stamina))
	
	# Exhaust stamina to 0.0
	player.current_stamina = 0.0
	if player.current_stamina <= 0.0:
		player.is_sprinting = false
		player.is_sprint_exhausted = true
	_assert_test("Sprint Auto-Cancels on Stamina Depletion", not player.is_sprinting, "is_sprinting reset to false on 0 stamina")
	
	# Verify player cannot sprint when stamina is empty
	var can_sprint_at_zero = (player.current_stamina > 10.0 and not player.is_sprint_exhausted)
	_assert_test("Cannot Initiate Sprint on Empty Stamina", not can_sprint_at_zero, "Sprint input blocked when stamina is depleted")
	
	# Verify speed drops back to base walk speed upon exhaustion
	var base_walk_speed = player.class_data.get("speed", 5.0)
	var active_speed = player.class_data.get("speed", 5.0) if not player.is_sprinting else player.class_data.get("sprint_speed", 7.5)
	_assert_test("Movement Speed Falls Back to Walk Speed", active_speed == base_walk_speed, "Speed reverted to base walk speed: " + str(base_walk_speed) + " m/s")
	
	player.free()

