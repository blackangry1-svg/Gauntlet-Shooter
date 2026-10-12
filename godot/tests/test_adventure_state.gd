extends SceneTree

const StateScript = preload("res:/" + "/scripts/adventure_state.gd")
const PlayerScript = preload("res:/" + "/scripts/adventure_player.gd")
const ProjectileScript = preload("res:/" + "/scripts/adventure_projectile.gd")
var passed: int = 0
var failed: int = 0
var save_test_path: String = ""
var stage: Node3D

class Target:
	extends StaticBody3D
	var hp: float = 100.0
	var hits: int = 0
	func _ready() -> void:
		collision_layer = 2
		collision_mask = 0
		var shape: CollisionShape3D = CollisionShape3D.new()
		var capsule: CapsuleShape3D = CapsuleShape3D.new()
		capsule.radius = 0.38
		capsule.height = 1.7
		shape.shape = capsule
		shape.position.y = 0.85
		add_child(shape)
	func take_damage(amount: float, _stagger: float = 0.0, _source: Vector3 = Vector3.ZERO) -> void:
		hp -= amount
		hits += 1

class Mechanism:
	extends StaticBody3D
	var hits: int = 0
	var last_weapon: String = ""
	func _ready() -> void:
		collision_layer = 8
		collision_mask = 0
		var shape: CollisionShape3D = CollisionShape3D.new()
		var box: BoxShape3D = BoxShape3D.new()
		box.size = Vector3(0.6, 1.6, 0.3)
		shape.shape = box
		shape.position.y = 0.8
		add_child(shape)
	func hit_weapon(id: String) -> void:
		hits += 1
		last_weapon = id

func _initialize() -> void:
	save_test_path = ProjectSettings.globalize_path("res:/" + "/../.codex-local/validation/adventure-contracts/state-test.json")
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--test-save="):
			save_test_path = argument.trim_prefix("--test-save=")
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

func _run() -> void:
	_test_inventory_and_upgrades()
	_test_progression_and_ammunition()
	_test_snapshot_and_saves()
	await _test_player_combat()
	print("ADVENTURE CONTRACT RESULTS: " + str(passed) + " passed; " + str(failed) + " failed")
	quit(0 if failed == 0 else 1)

func _test_inventory_and_upgrades() -> void:
	var state: Node = _new_state()
	_check("fresh hero owns driftwood only", state.export_snapshot()["items"] == {"driftwood": true})
	_check("fresh hero has no ammunition or unlocked floor", state.arrows == 0 and state.staff_charges == 0 and not state.can_travel_to(1))
	_check("unowned bow cannot be equipped", not state.equip_weapon("bow") and state.equipped_weapon == "driftwood")
	_check("unknown item cannot enter inventory", not state.has_item("invalid"))
	state._setup_audio()
	_check("essential audio buffers are generated once", state._cues.size() == 5 and state._cues["swing"].data.size() > 0 and state._cues["hurt"].data.size() > 0)
	state._setup_audio()
	_check("cue setup retains one bounded audio player", state.get_child_count() == 1)
	state.acquire_item("invalid")
	_check("unknown acquisition leaves inventory intact", state.export_snapshot()["items"].size() == 1)
	state.restock_at_checkpoint()
	_check("checkpoint cannot grant ranged equipment or ammunition", not state.has_item("bow") and not state.has_item("staff") and state.arrows == 0 and state.staff_charges == 0)
	state.acquire_item("sword")
	state.acquire_item("buckler")
	state.award_combat_reward(0, 80)
	state.level_up("strength")
	_check("earned sword equips without a class", state.equip_weapon("sword") and state.equipped_weapon == "sword")
	_check("base sword stats are explicit", is_equal_approx(state.weapon_def("sword")["damage"], 30.0 * 1.035) and state.weapon_def("sword")["reach"] > state.weapon_def("driftwood")["reach"])
	_check("upgrade without currency fails without mutation", not state.upgrade_tool("sword") and state.tool_level("sword") == 1)
	state.souls = 100
	_check("weapon upgrade spends exact currency", state.upgrade_tool("sword") and state.souls == 75 and state.tool_level("sword") == 2)
	_check("upgrade materially raises damage", is_equal_approx(state.weapon_def("sword")["damage"], 37.5 * 1.035))
	_check("second upgrade cost scales", state.upgrade_tool("sword") and state.souls == 25 and state.tool_level("sword") == 3)
	_check("max tier rejects further upgrade", not state.upgrade_tool("sword") and state.souls == 25)
	_check("buckler is independently upgradeable", state.upgrade_tool("buckler") and state.tool_level("buckler") == 2 and state.souls == 0)
	state.cycle_weapon(1)
	_check("cycle skips unowned equipment", state.equipped_weapon == "driftwood")
	state.cycle_weapon(-1)
	_check("reverse cycle wraps owned equipment", state.equipped_weapon == "sword")
	state.acquire_item("sun_seal")
	_check("quest seals cannot be sold as upgrades", not state.upgrade_tool("sun_seal"))
	state.free()

func _test_progression_and_ammunition() -> void:
	var state: Node = _new_state()
	_check("out-of-range floors reject travel", not state.can_travel_to(-1) and not state.can_travel_to(5))
	state.defeat_boss(0)
	_check("Earth boss grants bow and tide charm", state.has_item("bow") and state.has_item("tide_charm") and state.arrows == 18 and state.can_travel_to(1))
	var reward_currency: int = state.souls
	state.defeat_boss(0)
	_check("boss rewards cannot be farmed", state.souls == reward_currency and state.arrows == 18)
	_check("Water transition succeeds", state.change_floor(1) and state.current_floor == 1)
	state.defeat_boss(1)
	_check("Water boss grants finite staff charges and Fire access", state.has_item("staff") and state.has_item("ember_sigil") and state.staff_charges == 6 and state.can_travel_to(2))
	state.defeat_boss(2)
	_check("Fire boss grants spear and gale mantle", state.has_item("spear") and state.has_item("gale_mantle") and state.can_travel_to(3))
	state.defeat_boss(3)
	_check("Air boss alone cannot unlock final floor", state.has_item("aether_sight") and not state.can_travel_to(4))
	state.acquire_item("sun_seal")
	_check("one seal cannot unlock final floor", not state.can_travel_to(4))
	state.acquire_item("moon_seal")
	_check("both seals and Air victory unlock Aether", state.can_travel_to(4) and state.change_floor(4))
	state.defeat_boss(4)
	_check("final guardian awards tower heart", state.has_item("tower_heart"))
	_check("return to earlier floors remains available", state.change_floor(0) and state.can_travel_to(2))
	state.arrows = 1
	_check("last arrow is consumed exactly once", state.consume_ammo("bow") and state.arrows == 0 and not state.consume_ammo("bow"))
	state.staff_charges = 1
	_check("last staff charge is consumed exactly once", state.consume_ammo("staff") and state.staff_charges == 0 and not state.consume_ammo("staff"))
	state.restock_at_checkpoint()
	_check("owned ranged weapons receive anti-softlock restock", state.arrows == 10 and state.staff_charges == 4)
	state.add_ammo("bow", 100)
	state.add_ammo("staff", 100)
	_check("ammunition is capped", state.arrows == 60 and state.staff_charges == 20)
	state.add_ammo("bow", -4)
	_check("negative restock cannot remove ammunition", state.arrows == 60)
	state.restock_at_checkpoint()
	_check("restock preserves ammunition above minimum", state.arrows == 60 and state.staff_charges == 20)
	state.set_flag(0, "gate_open")
	state.set_flag(0, "shortcut_open")
	state.set_flag(0, "secret_test")
	var detached_flags: Dictionary = state.floor_flags(0)
	detached_flags["gate_open"] = false
	_check("floor flag snapshots cannot mutate internal state", state.has_flag(0, "gate_open"))
	state.set_checkpoint(2, Vector2i(5, 7))
	_check("checkpoint accepts unlocked floors", state.checkpoint_floor == 2 and state.checkpoint_cell == Vector2i(5, 7))
	state.set_checkpoint(5, Vector2i(-1, -1))
	_check("invalid checkpoint cannot replace valid checkpoint", state.checkpoint_floor == 2 and state.checkpoint_cell == Vector2i(5, 7))
	var clone: Node = _new_state()
	_check("full progression round-trips", clone.restore_snapshot(state.export_snapshot()) and clone.has_item("tower_heart") and clone.has_flag(0, "secret_test") and clone.checkpoint_cell == Vector2i(5, 7))
	clone.free()
	state.free()

func _test_snapshot_and_saves() -> void:
	var state: Node = _new_state()
	state.acquire_item("sword")
	var baseline: Dictionary = state.export_snapshot()
	var invalid: Dictionary = baseline.duplicate(true)
	invalid["schema_version"] = 99
	_check("unsupported schema is rejected transactionally", not state.restore_snapshot(invalid) and state.export_snapshot() == baseline)
	invalid = baseline.duplicate(true)
	invalid["equipped_weapon"] = "staff"
	_check("save cannot equip unearned equipment", not state.restore_snapshot(invalid))
	invalid = baseline.duplicate(true)
	invalid["arrows"] = 4
	_check("save cannot create ammunition for an unowned bow", not state.restore_snapshot(invalid))
	invalid = baseline.duplicate(true)
	invalid["floors"] = [{}, {}, {}, {}]
	_check("wrong floor count is rejected", not state.restore_snapshot(invalid))
	invalid = baseline.duplicate(true)
	invalid["checkpoint_cell"] = [-1, 500]
	_check("invalid checkpoint coordinates reject whole save", not state.restore_snapshot(invalid) and state.export_snapshot() == baseline)
	state.save_path = save_test_path
	_check("validated save can be written to isolated path", state.save_game())
	state.acquire_item("buckler")
	_check("second save rotates valid backup", state.save_game() and FileAccess.file_exists(save_test_path + ".bak"))
	var clone: Node = _new_state()
	clone.save_path = save_test_path
	_check("latest save restores inventory", clone.load_game() and clone.has_item("sword") and clone.has_item("buckler"))
	var file: FileAccess = FileAccess.open(save_test_path, FileAccess.WRITE)
	file.store_string("{broken")
	file.close()
	_check("corrupt primary falls back to previous valid save", clone.load_game() and clone.has_item("sword") and not clone.has_item("buckler"))
	_check("recovery can write a new valid primary", clone.save_game())
	var decoded: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(save_test_path))
	decoded["payload"] = str(decoded["payload"]) + " "
	file = FileAccess.open(save_test_path, FileAccess.WRITE)
	file.store_string(JSON.stringify(decoded))
	file.close()
	_check("checksum catches modified payload and recovers backup", clone.load_game() and clone.has_item("sword"))
	file = FileAccess.open(save_test_path, FileAccess.WRITE)
	file.store_string("not-json")
	file.close()
	file = FileAccess.open(save_test_path + ".bak", FileAccess.WRITE)
	file.store_string("not-json")
	file.close()
	var before: Dictionary = clone.export_snapshot()
	_check("two corrupt copies leave live progress untouched", not clone.load_game() and clone.export_snapshot() == before)
	clone.free()
	state.free()
	var boss_state: Node = _new_state()
	boss_state.save_path = save_test_path + ".boss-transaction"
	boss_state.save_game()
	boss_state.auto_save_enabled = true
	boss_state.defeat_boss(0)
	var prior: Dictionary = boss_state._decode_save(boss_state.save_path + ".bak")
	_check("boss milestone saves all rewards atomically", boss_state.has_item("tide_charm") and not bool(prior["floors"][0].get("boss_defeated", false)) and not bool(prior["items"].get("bow", false)))
	boss_state.free()

func _wall(position: Vector3) -> StaticBody3D:
	var wall: StaticBody3D = StaticBody3D.new()
	wall.collision_layer = 1
	wall.collision_mask = 0
	var collision: CollisionShape3D = CollisionShape3D.new()
	var shape: BoxShape3D = BoxShape3D.new()
	shape.size = Vector3(2.0, 2.4, 0.18)
	collision.shape = shape
	wall.add_child(collision)
	stage.add_child(wall)
	wall.position = position
	return wall


func _test_gale_tiers(actor: CharacterBody3D, state: Node) -> void:
	var original_position: Vector3 = actor.global_position
	state.acquire_item("gale_mantle")
	state.souls = 75
	for tier: int in range(1, 4):
		var upgraded: bool = true if tier == 1 else state.upgrade_tool("gale_mantle")
		var expected_cost: float = [20.0, 16.0, 12.0][tier - 1]
		actor.cancel_combat()
		actor.global_position = Vector3(10.0, 0.0, 10.0)
		actor.stamina = expected_cost - 0.01
		_check("gale tier " + str(tier) + " rejects insufficient stamina without spending", not actor.attempt_dodge() and is_equal_approx(actor.stamina, expected_cost - 0.01))
		actor.stamina = 100.0
		_check("gale tier " + str(tier) + " spends exact upgraded dodge cost", upgraded and state.tool_level("gale_mantle") == tier and actor.dodge_stamina_cost() == expected_cost and actor.attempt_dodge() and actor.stamina == 100.0 - expected_cost)
		_check("gale tier " + str(tier) + " cannot retrigger or extend dodge invulnerability", not actor.attempt_dodge() and actor.stamina == 100.0 - expected_cost and is_equal_approx(actor._dodge_time, 0.32) and is_equal_approx(actor._invulnerability_time, 0.22))
		actor._physics_process(0.01)
		_check("gale tier " + str(tier) + " keeps actual dodge speed and timing fixed", is_equal_approx(Vector2(actor.velocity.x, actor.velocity.z).length(), 9.5) and is_equal_approx(actor._dodge_time, 0.31) and is_equal_approx(actor._invulnerability_time, 0.21))
	actor.cancel_combat()
	actor.global_position = original_position
	actor.heal_to_full()

func _test_player_combat() -> void:
	stage = Node3D.new()
	root.add_child(stage)
	current_scene = stage
	var state: Node = _new_state()
	var actor: CharacterBody3D = PlayerScript.new()
	actor.configure(state)
	stage.add_child(actor)
	actor.set_physics_process(false)
	_check("single hero has specified health and stamina", actor.hp == actor.max_hp and actor.max_hp == 120.0 and actor.stamina == 100.0)
	_check("active player has correct collision and lookup group", actor.collision_layer == 4 and actor.collision_mask == 3 and actor.is_in_group("adventure_player"))
	_check("keyboard and controller adventure actions exist", InputMap.has_action("adventure_light") and InputMap.has_action("adventure_next") and InputMap.has_action("adventure_interact"))
	actor.hp = 55.0
	state.acquire_item("sword")
	state.award_combat_reward(0, 80)
	state.level_up("strength")
	state.equip_weapon("sword")
	_check("equipping gear cannot refill health", actor.hp == 55.0)
	state.equip_weapon("driftwood")
	actor.hp = 55.0
	actor.attempt_attack(false)
	actor.cancel_combat()
	_check("floor travel cancels attacks without healing", not actor.is_attacking and actor._pending_attack.is_empty() and actor.hp == 55.0 and actor.velocity == Vector3.ZERO)
	actor.heal_to_full()
	var target: StaticBody3D = Target.new()
	stage.add_child(target)
	target.position = Vector3(0.0, 0.0, -2.0)
	await physics_frame
	await physics_frame
	_check("attack begins with a windup", actor.attempt_attack(false) and target.hp == 100.0 and actor.stamina == actor.max_stamina - 10.0)
	actor._advance_combat(0.05)
	_check("melee cannot hit before windup expires", target.hp == 100.0)
	actor._advance_combat(0.08)
	_check("unobstructed melee hits once for specified damage", is_equal_approx(target.hp, 100.0 - state.weapon_def("driftwood")["damage"]) and target.hits == 1)
	_check("attack cooldown prevents repeated immediate attacks", not actor.attempt_attack(false))
	actor._advance_combat(1.0)
	target.hp = 100.0
	var wall: StaticBody3D = _wall(Vector3(0.0, 1.0, -1.0))
	await physics_frame
	await physics_frame
	actor._perform_melee({"weapon": "driftwood", "reach": 2.25, "damage": 18.0, "stagger": 0.2})
	_check("melee cannot damage a target behind a wall", target.hp == 100.0)
	wall.queue_free()
	await physics_frame
	await physics_frame
	target.queue_free()
	await physics_frame
	var feature: StaticBody3D = Mechanism.new()
	stage.add_child(feature)
	feature.position = Vector3(0.0, 0.0, -2.0)
	await physics_frame
	await physics_frame
	actor._perform_melee({"weapon": "spear", "reach": 4.0, "damage": 18.0, "stagger": 0.2})
	_check("weapon hits reach layer8 mechanisms", feature.hits == 1 and feature.last_weapon == "spear")
	feature.queue_free()
	await physics_frame
	state.acquire_item("bow")
	state.award_combat_reward(0, 140)
	state.level_up("dexterity")
	state.equip_weapon("bow")
	state.arrows = 0
	var stamina_before: float = actor.stamina
	_check("empty bow cannot start an attack or spend stamina", not actor.attempt_attack(false) and actor.stamina == stamina_before)
	state.arrows = 1
	_check("bow reserves one finite arrow per shot", actor.attempt_attack(false) and state.arrows == 0)
	actor._advance_combat(1.0)
	var projectile_nodes: Array[Node] = get_nodes_in_group("adventure_projectile")
	_check("windup produces a real projectile", projectile_nodes.size() == 1)
	_check("actual ranged projectile lifetime enforces declared weapon reach", projectile_nodes.size() == 1 and is_equal_approx(projectile_nodes[0].remaining_life * projectile_nodes[0].speed, float(state.weapon_def("bow")["reach"])))
	for projectile: Node in projectile_nodes:
		projectile.queue_free()
	await physics_frame
	actor._advance_combat(1.0)
	state.arrows = 1
	actor.attempt_attack(false)
	var crowded: Array[Node] = []
	for index: int in range(24):
		var placeholder: Node = Node.new()
		stage.add_child(placeholder)
		placeholder.add_to_group("adventure_projectile")
		crowded.append(placeholder)
	actor._advance_combat(1.0)
	_check("projectile cap holds when pool fills during windup", get_nodes_in_group("adventure_projectile").size() == 24 and state.arrows == 1)
	for placeholder: Node in crowded:
		placeholder.queue_free()
	await physics_frame
	actor.heal_to_full()
	_check("dodge consumes stamina", actor.attempt_dodge() and actor.stamina == actor.max_stamina - 20.0)
	actor.take_damage(30.0, Vector3(0.0, 0.0, -1.0))
	_check("dodge iframe blocks damage", actor.hp == actor.max_hp)
	actor._advance_combat(0.40)
	actor.take_damage(30.0, Vector3(0.0, 0.0, -1.0))
	_check("damage resumes when dodge iframe expires", actor.hp == actor.max_hp - 30.0)
	_test_gale_tiers(actor, state)
	state.acquire_item("buckler")
	actor.heal_to_full()
	actor.is_blocking = true
	actor.take_damage(40.0, Vector3(0.0, 1.0, -1.0))
	_check("buckler absorbs damage and spends stamina", absf(actor.hp - (actor.max_hp - 14.0)) < 0.01 and absf(actor.stamina - (actor.max_stamina - 28.0)) < 0.01)
	state.souls = 25
	state.upgrade_tool("buckler")
	actor.heal_to_full()
	actor.is_blocking = true
	actor.take_damage(40.0, Vector3(0.0, 1.0, -1.0))
	_check("buckler upgrade improves actual damage absorption", absf(actor.hp - (actor.max_hp - 10.0)) < 0.01)
	actor.heal_to_full()
	actor.is_blocking = true
	actor.take_damage(40.0, Vector3(0.0, 1.0, 2.0))
	_check("guard cannot absorb attacks from behind", actor.hp == actor.max_hp - 40.0)
	actor.heal_to_full()
	actor.is_blocking = true
	actor.stamina = 1.0
	actor.take_damage(40.0, Vector3(0.0, 1.0, -1.0))
	_check("depleted guard breaks and sustains damage", actor.is_guard_broken and actor.stamina == 0.0 and actor.hp == actor.max_hp - 40.0 and not actor.attempt_attack(false))
	actor._advance_combat(1.0)
	actor.is_blocking = false
	actor.hp = 50.0
	_check("healing is finite and restores bounded health", actor.use_healing() and actor.flasks == 2 and actor.hp == 105.0)
	actor.set_diving(true)
	actor.global_position.y = -2.0
	actor._physics_process(0.02)
	_check("dive locks relocated underwater depth", actor.is_diving and absf(actor.global_position.y + 2.0) < 0.001)
	actor.set_physics_process(false)
	actor.hp = 1.0
	actor.take_damage(10.0, Vector3(0.0, 0.0, -1.0))
	_check("fatal damage enters dead state", actor.hp == 0.0)
	actor.checkpoint_respawn(Vector3(2.0, 0.0, 2.0))
	_check("checkpoint recovery restores player without erasing gear", actor.hp == actor.max_hp and actor.stamina == actor.max_stamina and actor.flasks == 3 and not actor.is_diving and state.has_item("sword") and actor.global_position == Vector3(2.0, 0.0, 2.0))
	actor.global_position = Vector3.ZERO
	target = Target.new()
	stage.add_child(target)
	target.position = Vector3(0.0, 0.0, -2.0)
	wall = _wall(Vector3(0.0, 1.0, -1.0))
	await physics_frame
	await physics_frame
	var arrow: Area3D = ProjectileScript.new()
	arrow.direction = Vector3.FORWARD
	arrow.owner_actor = actor
	stage.add_child(arrow)
	arrow.global_position = Vector3(0.0, 1.1, 0.0)
	arrow.set_physics_process(false)
	arrow._physics_process(0.2)
	_check("fast projectile sweep stops at walls without harming target", arrow.is_queued_for_deletion() and target.hp == 100.0)
	stage.queue_free()
	await physics_frame
	await physics_frame
	state.free()
