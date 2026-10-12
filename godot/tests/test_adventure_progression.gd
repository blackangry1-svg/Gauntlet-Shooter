extends SceneTree

const StateScript = preload("res:/" + "/scripts/adventure_state.gd")
const PlayerScript = preload("res:/" + "/scripts/adventure_player.gd")
const FIXTURE_PATH: String = "res:/" + "/tests/fixtures/adventure_schema1_owned.json"
const FIXTURE_SHA: String = "7e50717de7925b16fcb562432939dd554de6c2436a4f6da4fb3b61893b89c94b"
var passed: int = 0
var failed: int = 0
var isolated_path: String

func _initialize() -> void:
	isolated_path = ProjectSettings.globalize_path("res:/" + "/../.codex-local/validation/earth-width/progression.json")
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--test-save="):
			isolated_path = argument.trim_prefix("--test-save=")
	call_deferred("_run")

func _check(label: String, condition: bool) -> void:
	if condition:
		passed += 1
		print("PASS: " + label)
	else:
		failed += 1
		push_error("FAIL: " + label)

func _new_state() -> Node:
	var state: Node = StateScript.new()
	state.auto_save_enabled = false
	state.new_game()
	return state

func _write_file(path: String, bytes: PackedByteArray) -> void:
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var file: FileAccess = FileAccess.open(path, FileAccess.WRITE)
	file.store_buffer(bytes)
	file.close()

func _test_levels_and_equipment() -> void:
	var state: Node = _new_state()
	_check("new hero begins level one with no invented XP", state.hero_level == 1 and state.experience == 0 and state.hero_attributes == {"strength": 5, "dexterity": 5, "focus": 5})
	_check("base capacities and unrestricted driftwood survive progression introduction", state.get_character_stats()["max_hp"] == 120.0 and state.get_character_stats()["max_stamina"] == 100.0 and state.can_equip("driftwood"))
	for id: String in ["sword", "bow", "staff", "spear"]:
		state.acquire_item(id)
		_check("owned " + id + " is stat locked at level one", not state.can_equip(id) and not state.equip_weapon(id))
	state.cycle_weapon(1)
	state.cycle_weapon(-1)
	_check("both cycle directions skip locked owned equipment", state.equipped_weapon == "driftwood")
	var before: Dictionary = state.export_snapshot()
	_check("invalid allocation and negative combat reward are transactional", not state.level_up("luck") and not state.level_up("strength") and not state.award_combat_reward(-1, 40) and not state.award_combat_reward(1, -40) and state.export_snapshot() == before)
	_check("combat reward separates XP and Embers without automatic levels", state.award_combat_reward(12, 80) and state.experience == 80 and state.souls == 12 and state.hero_level == 1 and state.can_level_up())
	_check("first selected strength level consumes exact XP and unlocks sword only", state.level_up("strength") and state.hero_level == 2 and state.experience == 0 and state.attribute_value("strength") == 6 and state.can_equip("sword") and not state.can_equip("bow"))
	_check("next refuge price rises to140 without spending Embers", state.level_up_cost() == 140 and state.souls == 12)
	state.award_combat_reward(0, 140)
	_check("dexterity allocation unlocks owned bow and raises bounded capacities", state.level_up("dexterity") and state.can_equip("bow") and state.get_character_stats()["max_hp"] == 130.0 and state.get_character_stats()["max_stamina"] == 106.0)
	state.award_combat_reward(0, 230)
	_check("focus allocation opens staff while spear still needs strength", state.level_up("focus") and state.can_equip("staff") and not state.can_equip("spear") and state.level_up_cost() == 350)
	state.award_combat_reward(0, 350)
	_check("second strength point meets both spear requirements", state.level_up("strength") and state.can_equip("spear") and state.weapon_requirements("spear") == {"strength": 7, "dexterity": 6})
	state.equip_weapon("sword")
	_check("attribute damage grows modestly alongside unchanged reach", is_equal_approx(state.weapon_def("sword")["damage"], 32.1) and state.weapon_def("sword")["reach"] == 2.7)
	state.souls = 75
	state.upgrade_tool("sword")
	state.upgrade_tool("sword")
	_check("combat rating includes at most two equipped tier points", state.get_combat_rating() == state.hero_level + 2)
	state.equip_weapon("bow")
	_check("rating follows actual equipped weapon tier", state.get_combat_rating() == state.hero_level)
	var stats_copy: Dictionary = state.get_character_stats()
	stats_copy["attributes"]["strength"] = 999
	_check("public stat snapshots cannot mutate live attributes", state.attribute_value("strength") == 7)
	state.award_combat_reward(0, 1000000000)
	var allocations: int = 0
	while state.can_level_up():
		if not state.level_up("focus"):
			break
		allocations += 1
	var capped: Dictionary = state.export_snapshot()
	_check("level cap30 prevents further allocation despite stored XP", allocations == 25 and state.hero_level == 30 and state.level_up_cost() == 0 and not state.level_up("strength") and state.export_snapshot() == capped)
	state.free()

func _test_player_sync() -> void:
	var stage: Node3D = Node3D.new()
	root.add_child(stage)
	current_scene = stage
	var state: Node = _new_state()
	var actor: CharacterBody3D = PlayerScript.new()
	actor.configure(state)
	stage.add_child(actor)
	actor.set_physics_process(false)
	state.acquire_item("bow")
	state.equipped_weapon = "bow"
	actor.hp = 53.0
	actor.stamina = 47.0
	var arrows_before: int = state.arrows
	_check("actual attack rejects bypassed locked equip before ammo or stamina", not actor.attempt_attack() and state.arrows == arrows_before and actor.stamina == 47.0 and actor._pending_attack.is_empty())
	state.equipped_weapon = "driftwood"
	state.award_combat_reward(0, 80)
	state.level_up("strength")
	_check("stat signal raises capacity without healing current resources", actor.max_hp == 126.0 and actor.max_stamina == 102.0 and actor.hp == 53.0 and actor.stamina == 47.0)
	actor.sync_character_stats()
	_check("repeated stat synchronization cannot manufacture recovery", actor.hp == 53.0 and actor.stamina == 47.0)
	state.arrows = 0
	actor.flasks = 0
	actor.rest_at_checkpoint()
	_check("explicit refuge rest heals enlarged capacity and restocks only owned weapon", actor.hp == 126.0 and actor.stamina == 102.0 and actor.flasks == 3 and state.arrows == 10 and state.staff_charges == 0 and not state.has_item("staff"))
	actor.hp = 61.0
	actor.stamina = 31.0
	state.acquire_item("sword")
	state.equip_weapon("sword")
	state.souls = 25
	state.upgrade_tool("sword")
	_check("equip and tier upgrades preserve health and stamina after leveling", actor.hp == 61.0 and actor.stamina == 31.0)
	state.save_path = isolated_path + ".leveled"
	_check("leveled hero fixture explicitly saves", state.save_game())
	var restored: Node = _new_state()
	restored.save_path = state.save_path
	_check("leveled hero reload preserves attributes", restored.load_game() and restored.hero_level == 2 and restored.attribute_value("strength") == 6)
	var restarted: CharacterBody3D = PlayerScript.new()
	restarted.configure(restored)
	stage.add_child(restarted)
	restarted.set_physics_process(false)
	_check("fresh loaded hero starts at full enlarged health and stamina", restarted.hp == 126.0 and restarted.stamina == 102.0 and actor.hp == 61.0 and actor.stamina == 31.0)
	stage.queue_free()
	await physics_frame
	await physics_frame
	current_scene = null
	restored.free()
	state.free()

func _test_migration() -> void:
	var fixture_bytes: PackedByteArray = FileAccess.get_file_as_bytes(FIXTURE_PATH)
	var fixture_hash: String = FileAccess.get_sha256(FIXTURE_PATH)
	var fixture_text: String = fixture_bytes.get_string_from_utf8()
	_check("committed old save fixture matches frozen checksum", fixture_text.strip_edges().sha256_text() == FIXTURE_SHA)
	_write_file(isolated_path, fixture_bytes)
	for suffix: String in [".bak", ".tmp"]:
		if FileAccess.file_exists(isolated_path + suffix):
			DirAccess.remove_absolute(isolated_path + suffix)
	var old: Dictionary = JSON.parse_string(JSON.parse_string(fixture_text)["payload"])
	var state: Node = _new_state()
	state.save_path = isolated_path
	state.auto_save_enabled = true
	_check("schema1 checksum envelope loads successfully", state.load_game())
	_check("loading migration leaves both fixture and primary byte unchanged", FileAccess.get_sha256(FIXTURE_PATH) == fixture_hash and FileAccess.get_file_as_bytes(isolated_path) == fixture_bytes and not FileAccess.file_exists(isolated_path + ".bak"))
	_check("migration creates no XP or attribute levels", state.hero_level == 1 and state.experience == 0 and state.hero_attributes == {"strength": 5, "dexterity": 5, "focus": 5})
	var migrated: Dictionary = state.export_snapshot()
	for field: String in ["current_floor", "checkpoint_floor", "checkpoint_cell", "equipped_weapon", "arrows", "staff_charges", "souls", "items", "levels", "floors"]:
		var preserved: bool = migrated[field] == old[field]
		if field == "checkpoint_cell":
			preserved = state.checkpoint_cell == Vector2i(int(old[field][0]), int(old[field][1]))
		elif field == "levels":
			preserved = migrated[field].size() == old[field].size()
			for id: String in old[field]:
				preserved = preserved and state.tool_level(id) == int(old[field][id])
		_check("migration preserves " + field, preserved)
	for id: String in ["driftwood", "sword", "bow", "staff", "spear"]:
		_check("old owned " + id + " retains permanent explicit attunement", state.can_equip(id) and migrated["legacy_attunement"].get(id, false))
	_check("explicit save produces schema2 only after user milestone", state.save_game() and JSON.parse_string(FileAccess.get_file_as_string(isolated_path))["schema"] == 2 and FileAccess.get_file_as_bytes(isolated_path + ".bak") == fixture_bytes)
	var reloaded: Node = _new_state()
	reloaded.save_path = isolated_path
	_check("schema2 roundtrip retains migrated progress and attunement", reloaded.load_game() and reloaded.export_snapshot() == migrated and reloaded.can_equip("staff"))
	var invalid: Dictionary = migrated.duplicate(true)
	invalid["hero_level"] = 2
	var live: Dictionary = reloaded.export_snapshot()
	_check("inconsistent attribute allocation is rejected transactionally", not reloaded.restore_snapshot(invalid) and reloaded.export_snapshot() == live)
	invalid = migrated.duplicate(true)
	invalid["hero_attributes"]["luck"] = 5
	_check("unknown attribute is rejected", not reloaded.restore_snapshot(invalid))
	invalid = migrated.duplicate(true)
	invalid["legacy_attunement"]["tower_heart"] = true
	_check("nonweapon legacy exemption is rejected", not reloaded.restore_snapshot(invalid))
	invalid = migrated.duplicate(true)
	invalid["experience"] = 1.5
	_check("fractional XP is rejected", not reloaded.restore_snapshot(invalid))
	invalid = migrated.duplicate(true)
	invalid["legacy_attunement"] = {}
	_check("locked equipped weapon without attunement is rejected", not reloaded.restore_snapshot(invalid))
	_write_file(isolated_path, "damaged primary".to_utf8_buffer())
	_check("schema1 backup recovers with no automatic rewrite", reloaded.load_game() and reloaded.can_equip("staff") and FileAccess.get_file_as_string(isolated_path) == "damaged primary" and FileAccess.get_file_as_bytes(isolated_path + ".bak") == fixture_bytes)
	var seed: Node = _new_state()
	var old_fresh: Dictionary = seed.export_snapshot()
	seed.free()
	old_fresh["schema_version"] = 1
	for field: String in ["hero_level", "experience", "hero_attributes", "legacy_attunement"]:
		old_fresh.erase(field)
	var fresh: Node = _new_state()
	_check("minimal schema1 profile migrates", fresh.restore_snapshot(old_fresh))
	fresh.acquire_item("bow")
	_check("new acquisitions after migration still require attributes", not fresh.can_equip("bow"))
	_check("test never changes committed fixture bytes", FileAccess.get_sha256(FIXTURE_PATH) == fixture_hash)
	fresh.free()
	reloaded.free()
	state.free()

func _test_atomic_boss_rewards() -> void:
	var state: Node = _new_state()
	state.save_path = isolated_path + ".boss"
	state.auto_save_enabled = true
	state.save_game()
	var expected_xp: int = 0
	for floor: int in range(5):
		state.defeat_boss(floor)
		expected_xp += [120, 180, 240, 300, 360][floor]
		var checkpoint: Dictionary = state.export_snapshot()
		state.defeat_boss(floor)
		var restored: Node = _new_state()
		restored.save_path = state.save_path
		_check("boss" + str(floor) + " saves XP and reward atomically once", state.experience == expected_xp and state.export_snapshot() == checkpoint and restored.load_game() and restored.export_snapshot() == checkpoint and restored.has_flag(floor, "boss_defeated"))
		restored.free()
	_check("all boss XP remains separate from hero level and currency", state.experience == 1200 and state.hero_level == 1 and state.souls == 700)
	state.free()

func _run() -> void:
	_test_levels_and_equipment()
	await _test_player_sync()
	_test_migration()
	_test_atomic_boss_rewards()
	print("ADVENTURE PROGRESSION: " + str(passed) + " passed, " + str(failed) + " failed")
	quit(1 if failed > 0 else 0)
