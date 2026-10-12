extends Node

signal inventory_changed
signal progression_changed
signal floor_changed(index: int)
signal message(text: String)

const AudioSynthScript = preload("res:/" + "/scripts/audio_synth.gd")
const SCHEMA_VERSION: int = 2
const MAX_HERO_LEVEL: int = 30
const ATTRIBUTES: Array[String] = ["strength", "dexterity", "focus"]
const WEAPON_REQUIREMENTS: Dictionary = {"driftwood": {}, "sword": {"strength": 6}, "bow": {"dexterity": 6}, "staff": {"focus": 6}, "spear": {"strength": 7, "dexterity": 6}}
const BOSS_XP: Array[int] = [120, 180, 240, 300, 360]
const WEAPONS: Array[String] = ["driftwood", "sword", "bow", "staff", "spear"]
const ITEM_IDS: Array[String] = ["driftwood", "sword", "bow", "staff", "spear", "buckler", "tide_charm", "ember_sigil", "gale_mantle", "aether_sight", "sun_seal", "moon_seal", "tower_heart"]
const UPGRADEABLE: Array[String] = ["driftwood", "sword", "bow", "staff", "spear", "buckler", "tide_charm", "ember_sigil", "gale_mantle", "aether_sight"]
const MAX_ARROWS: int = 60
const MAX_CHARGES: int = 20
const WEAPON_DATA: Dictionary = {
	"driftwood": {"name": "Shore Driftwood", "damage": 18.0, "heavy_damage": 34.0, "reach": 2.25, "stamina": 10.0, "heavy_stamina": 22.0, "windup": 0.10, "heavy_windup": 0.28, "cooldown": 0.42, "heavy_cooldown": 0.78},
	"sword": {"name": "Stranded Knight's Sword", "damage": 30.0, "heavy_damage": 54.0, "reach": 2.7, "stamina": 14.0, "heavy_stamina": 30.0, "windup": 0.12, "heavy_windup": 0.32, "cooldown": 0.48, "heavy_cooldown": 0.88},
	"bow": {"name": "Tidewood Bow", "damage": 28.0, "heavy_damage": 42.0, "reach": 55.0, "stamina": 9.0, "heavy_stamina": 16.0, "speed": 32.0, "windup": 0.16, "heavy_windup": 0.36, "cooldown": 0.58, "heavy_cooldown": 0.92},
	"staff": {"name": "Ember Wizard's Staff", "damage": 42.0, "heavy_damage": 66.0, "reach": 45.0, "stamina": 12.0, "heavy_stamina": 24.0, "speed": 22.0, "windup": 0.18, "heavy_windup": 0.40, "cooldown": 0.68, "heavy_cooldown": 1.10},
	"spear": {"name": "Valkyrie's Spear", "damage": 32.0, "heavy_damage": 52.0, "reach": 4.0, "stamina": 14.0, "heavy_stamina": 26.0, "windup": 0.14, "heavy_windup": 0.34, "cooldown": 0.56, "heavy_cooldown": 0.94}
}

var current_floor: int = 0
var checkpoint_floor: int = 0
var checkpoint_cell: Vector2i = Vector2i(1, 1)
var equipped_weapon: String = "driftwood"
var arrows: int = 0
var staff_charges: int = 0
var souls: int = 0
var hero_level: int = 1
var experience: int = 0
var hero_attributes: Dictionary = {"strength": 5, "dexterity": 5, "focus": 5}
var _legacy_attunement: Dictionary = {}
var save_path: String = "user:/" + "/adventure_v1.json"
var auto_save_enabled: bool = true
var _items: Dictionary = {"driftwood": true}
var _levels: Dictionary = {"driftwood": 1}
var _floors: Array = [{}, {}, {}, {}, {}]
var _cues: Dictionary = {}
var _cue_player: AudioStreamPlayer

func _ready() -> void:
	_setup_audio()
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--adventure-save="):
			save_path = argument.trim_prefix("--adventure-save=")
	if not load_game():
		new_game()

func new_game() -> void:
	current_floor = 0
	checkpoint_floor = 0
	checkpoint_cell = Vector2i(1, 1)
	equipped_weapon = "driftwood"
	arrows = 0
	staff_charges = 0
	souls = 0
	hero_level = 1
	experience = 0
	hero_attributes = {"strength": 5, "dexterity": 5, "focus": 5}
	_legacy_attunement = {}
	_items = {"driftwood": true}
	_levels = {"driftwood": 1}
	_floors = [{}, {}, {}, {}, {}]
	_changed(true)
	floor_changed.emit(current_floor)

func has_item(id: String) -> bool:
	return bool(_items.get(id, false))

func acquire_item(id: String) -> void:
	if not id in ITEM_IDS or has_item(id):
		return
	_items[id] = true
	if id in UPGRADEABLE:
		_levels[id] = 1
	if id == "bow":
		arrows = mini(MAX_ARROWS, arrows + 18)
	elif id == "staff":
		staff_charges = mini(MAX_CHARGES, staff_charges + 6)
	_changed(true)
	play_cue("pickup")
	message.emit("Acquired " + str(weapon_def(id).get("name", id.replace("_", " ").capitalize())))

func equip_weapon(id: String) -> bool:
	if not can_equip(id):
		return false
	if equipped_weapon != id:
		equipped_weapon = id
		_changed(true)
	return true

func cycle_weapon(direction: int) -> void:
	if direction == 0:
		return
	var start: int = WEAPONS.find(equipped_weapon)
	var step: int = 1 if direction > 0 else -1
	for offset: int in range(1, WEAPONS.size() + 1):
		var index: int = posmod(start + offset * step, WEAPONS.size())
		if can_equip(WEAPONS[index]):
			equip_weapon(WEAPONS[index])
			return

func consume_ammo(weapon: String) -> bool:
	if not has_item(weapon):
		return false
	if weapon == "bow":
		if arrows <= 0:
			return false
		arrows -= 1
	elif weapon == "staff":
		if staff_charges <= 0:
			return false
		staff_charges -= 1
	elif not weapon in WEAPONS:
		return false
	_changed(true)
	return true

func add_ammo(weapon: String, amount: int) -> void:
	if amount <= 0 or not has_item(weapon):
		return
	if weapon == "bow":
		arrows = mini(MAX_ARROWS, arrows + amount)
	elif weapon == "staff":
		staff_charges = mini(MAX_CHARGES, staff_charges + amount)
	else:
		return
	_changed(true)

func restock_at_checkpoint() -> void:
	if has_item("bow"):
		arrows = maxi(arrows, 10)
	if has_item("staff"):
		staff_charges = maxi(staff_charges, 4)
	_changed(true)

func tool_level(id: String) -> int:
	if not has_item(id):
		return 0
	return int(_levels.get(id, 1))

func upgrade_cost(id: String) -> int:
	if not id in UPGRADEABLE or not has_item(id) or tool_level(id) >= 3:
		return 0
	return 25 * tool_level(id)

func upgrade_tool(id: String) -> bool:
	var cost: int = upgrade_cost(id)
	if cost <= 0 or souls < cost:
		return false
	souls -= cost
	_levels[id] = tool_level(id) + 1
	_changed(true)
	message.emit(id.replace("_", " ").capitalize() + " upgraded to " + str(tool_level(id)))
	return true

func attribute_value(id: String) -> int:
	return int(hero_attributes.get(id, 0))

func level_up_cost() -> int:
	if hero_level >= MAX_HERO_LEVEL:
		return 0
	var n: int = hero_level - 1
	return 80 + 45 * n + 15 * n * n

func can_level_up() -> bool:
	return hero_level < MAX_HERO_LEVEL and experience >= level_up_cost()

func level_up(attribute: String) -> bool:
	if not attribute in ATTRIBUTES or not can_level_up():
		return false
	experience -= level_up_cost()
	hero_level += 1
	hero_attributes[attribute] = attribute_value(attribute) + 1
	_changed(true)
	return true

func weapon_requirements(id: String) -> Dictionary:
	return WEAPON_REQUIREMENTS.get(id, {}).duplicate(true)

func can_equip(id: String) -> bool:
	if not id in WEAPONS or not has_item(id):
		return false
	if bool(_legacy_attunement.get(id, false)):
		return true
	for attribute: String in weapon_requirements(id):
		if attribute_value(attribute) < int(WEAPON_REQUIREMENTS[id][attribute]):
			return false
	return true

func get_combat_rating() -> int:
	return hero_level + clampi(tool_level(equipped_weapon) - 1, 0, 2)

func get_character_stats() -> Dictionary:
	return {"hero_level": hero_level, "experience": experience, "attributes": hero_attributes.duplicate(true), "max_hp": 120.0 + 4.0 * (hero_level - 1) + 2.0 * (attribute_value("strength") - 5), "max_stamina": 100.0 + 2.0 * (hero_level - 1) + 2.0 * (attribute_value("dexterity") - 5), "combat_rating": get_combat_rating()}

func award_combat_reward(embers: int, xp: int, ammo_rewards: Dictionary = {}) -> bool:
	if embers < 0 or xp < 0:
		return false
	var previous_arrows: int = arrows
	var previous_charges: int = staff_charges
	if has_item("bow"):
		arrows = mini(MAX_ARROWS, arrows + maxi(0, int(ammo_rewards.get("bow", 0))))
	if has_item("staff"):
		staff_charges = mini(MAX_CHARGES, staff_charges + maxi(0, int(ammo_rewards.get("staff", 0))))
	var ammo_changed: bool = previous_arrows != arrows or previous_charges != staff_charges
	if embers == 0 and xp == 0 and not ammo_changed:
		return false
	souls = mini(1000000000, souls + embers)
	experience = mini(1000000000, experience + xp)
	_changed(ammo_changed)
	return true

func _attribute_damage_multiplier(id: String) -> float:
	var governing: float = float(attribute_value("strength"))
	if id == "bow":
		governing = float(attribute_value("dexterity"))
	elif id == "staff":
		governing = float(attribute_value("focus"))
	elif id == "spear":
		governing = 0.5 * (attribute_value("strength") + attribute_value("dexterity"))
	return 1.0 + 0.035 * maxf(0.0, governing - 5.0)

func weapon_def(id: String) -> Dictionary:
	if not WEAPON_DATA.has(id):
		return {}
	var definition: Dictionary = WEAPON_DATA[id].duplicate(true)
	var multiplier: float = (1.0 + 0.25 * maxi(0, tool_level(id) - 1)) * _attribute_damage_multiplier(id)
	definition["damage"] = float(definition["damage"]) * multiplier
	definition["heavy_damage"] = float(definition["heavy_damage"]) * multiplier
	definition["level"] = tool_level(id)
	return definition

func has_flag(floor: int, id: String) -> bool:
	return floor >= 0 and floor < 5 and bool(_floors[floor].get(id, false))

func set_flag(floor: int, id: String, value: bool = true) -> void:
	if floor < 0 or floor >= 5 or id.is_empty() or has_flag(floor, id) == value:
		return
	_floors[floor][id] = value
	_changed(false)

func floor_flags(floor: int) -> Dictionary:
	if floor < 0 or floor >= 5:
		return {}
	return _floors[floor].duplicate(true)

func can_travel_to(floor: int) -> bool:
	if floor < 0 or floor >= 5:
		return false
	if floor == 0:
		return true
	if not has_flag(floor - 1, "boss_defeated"):
		return false
	return floor != 4 or (has_item("sun_seal") and has_item("moon_seal"))

func change_floor(floor: int) -> bool:
	if not can_travel_to(floor):
		message.emit("The tower's next passage remains sealed.")
		return false
	if current_floor != floor:
		current_floor = floor
		_changed(false)
		floor_changed.emit(floor)
	return true

func set_checkpoint(floor: int, cell: Vector2i) -> void:
	if not can_travel_to(floor) or cell.x < 0 or cell.y < 0 or cell.x >= 31 or cell.y >= 31:
		return
	checkpoint_floor = floor
	checkpoint_cell = cell
	_changed(false)

func defeat_boss(floor: int) -> void:
	if floor < 0 or floor >= 5 or has_flag(floor, "boss_defeated"):
		return
	_floors[floor]["boss_defeated"] = true
	var rewards: Array = [["bow", "tide_charm"], ["staff", "ember_sigil"], ["spear", "gale_mantle"], ["aether_sight"], ["tower_heart"]]
	var resume_autosave: bool = auto_save_enabled
	auto_save_enabled = false
	for id: String in rewards[floor]:
		acquire_item(id)
	auto_save_enabled = resume_autosave
	souls = mini(1000000000, souls + 80 + floor * 30)
	experience = mini(1000000000, experience + BOSS_XP[floor])
	_changed(true)
	message.emit("Guardian defeated. The tower remembers your victory.")

func export_snapshot() -> Dictionary:
	return {"schema_version": SCHEMA_VERSION, "current_floor": current_floor, "checkpoint_floor": checkpoint_floor, "checkpoint_cell": [checkpoint_cell.x, checkpoint_cell.y], "equipped_weapon": equipped_weapon, "arrows": arrows, "staff_charges": staff_charges, "souls": souls, "hero_level": hero_level, "experience": experience, "hero_attributes": hero_attributes.duplicate(true), "legacy_attunement": _legacy_attunement.duplicate(true), "items": _items.duplicate(true), "levels": _levels.duplicate(true), "floors": _floors.duplicate(true)}

func _valid_integer(value: Variant, low: int, high: int) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and float(value) == float(int(value)) and int(value) >= low and int(value) <= high

func _normalize_snapshot(data: Dictionary) -> Dictionary:
	if not _valid_integer(data.get("schema_version"), 1, SCHEMA_VERSION):
		return {}
	for field: String in ["current_floor", "checkpoint_floor"]:
		if not _valid_integer(data.get(field), 0, 4):
			return {}
	if not _valid_integer(data.get("arrows"), 0, MAX_ARROWS) or not _valid_integer(data.get("staff_charges"), 0, MAX_CHARGES) or not _valid_integer(data.get("souls"), 0, 1000000000):
		return {}
	if not data.get("items") is Dictionary or not data.get("levels") is Dictionary or not data.get("floors") is Array or not data.get("checkpoint_cell") is Array:
		return {}
	var items: Dictionary = data["items"]
	var levels: Dictionary = data["levels"]
	var floors: Array = data["floors"]
	var cell: Array = data["checkpoint_cell"]
	if floors.size() != 5 or cell.size() != 2 or not _valid_integer(cell[0], 0, 30) or not _valid_integer(cell[1], 0, 30):
		return {}
	if not bool(items.get("driftwood", false)) or not data.get("equipped_weapon") is String:
		return {}
	var weapon: String = data["equipped_weapon"]
	if not weapon in WEAPONS or not bool(items.get(weapon, false)):
		return {}
	for id: Variant in items:
		if not id is String or not id in ITEM_IDS or not items[id] is bool or not items[id]:
			return {}
	for id: Variant in levels:
		if not id is String or not id in UPGRADEABLE or not bool(items.get(id, false)) or not _valid_integer(levels[id], 1, 3):
			return {}
	for floor: Variant in floors:
		if not floor is Dictionary:
			return {}
		for flag: Variant in floor:
			if not flag is String or not floor[flag] is bool:
				return {}
	for field: String in ["current_floor", "checkpoint_floor"]:
		var index: int = int(data[field])
		if index > 0 and not bool(floors[index - 1].get("boss_defeated", false)):
			return {}
		if index == 4 and not (bool(items.get("sun_seal", false)) and bool(items.get("moon_seal", false))):
			return {}
	if (int(data["arrows"]) > 0 and not bool(items.get("bow", false))) or (int(data["staff_charges"]) > 0 and not bool(items.get("staff", false))):
		return {}
	var normalized: Dictionary = data.duplicate(true)
	normalized["schema_version"] = SCHEMA_VERSION
	for field: String in ["current_floor", "checkpoint_floor", "arrows", "staff_charges", "souls"]:
		normalized[field] = int(data[field])
	normalized["checkpoint_cell"] = [int(cell[0]), int(cell[1])]
	normalized["levels"] = {}
	for id: String in levels:
		normalized["levels"][id] = int(levels[id])
	if int(data["schema_version"]) == 1:
		normalized["hero_level"] = 1
		normalized["experience"] = 0
		normalized["hero_attributes"] = {"strength": 5, "dexterity": 5, "focus": 5}
		var attunement: Dictionary = {}
		for id: String in WEAPONS:
			if bool(items.get(id, false)):
				attunement[id] = true
		normalized["legacy_attunement"] = attunement
	else:
		if not _valid_integer(data.get("hero_level"), 1, MAX_HERO_LEVEL) or not _valid_integer(data.get("experience"), 0, 1000000000):
			return {}
		if not data.get("hero_attributes") is Dictionary or not data.get("legacy_attunement") is Dictionary:
			return {}
		normalized["hero_level"] = int(data["hero_level"])
		normalized["experience"] = int(data["experience"])
		normalized["hero_attributes"] = {}
		var attributes: Dictionary = data["hero_attributes"]
		if attributes.size() != ATTRIBUTES.size():
			return {}
		var points: int = 0
		for attribute: String in ATTRIBUTES:
			if not _valid_integer(attributes.get(attribute), 5, 5 + MAX_HERO_LEVEL - 1):
				return {}
			points += int(attributes[attribute]) - 5
			normalized["hero_attributes"][attribute] = int(attributes[attribute])
		if points != int(data["hero_level"]) - 1:
			return {}
		var attunement: Dictionary = data["legacy_attunement"]
		for id: Variant in attunement:
			if not id is String or not id in WEAPONS or not bool(items.get(id, false)) or not attunement[id] is bool or not attunement[id]:
				return {}
		if not bool(attunement.get(weapon, false)):
			for attribute: String in WEAPON_REQUIREMENTS[weapon]:
				if int(attributes[attribute]) < int(WEAPON_REQUIREMENTS[weapon][attribute]):
					return {}
	return normalized

func restore_snapshot(data: Dictionary) -> bool:
	var valid: Dictionary = _normalize_snapshot(data)
	if valid.is_empty():
		return false
	current_floor = int(valid["current_floor"])
	checkpoint_floor = int(valid["checkpoint_floor"])
	var cell: Array = valid["checkpoint_cell"]
	checkpoint_cell = Vector2i(int(cell[0]), int(cell[1]))
	equipped_weapon = str(valid["equipped_weapon"])
	arrows = int(valid["arrows"])
	staff_charges = int(valid["staff_charges"])
	souls = int(valid["souls"])
	hero_level = int(valid["hero_level"])
	experience = int(valid["experience"])
	hero_attributes = valid["hero_attributes"].duplicate(true)
	_legacy_attunement = valid["legacy_attunement"].duplicate(true)
	_items = valid["items"].duplicate(true)
	_levels = valid["levels"].duplicate(true)
	_floors = valid["floors"].duplicate(true)
	inventory_changed.emit()
	progression_changed.emit()
	return true

func _decode_save(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var decoder: JSON = JSON.new()
	if decoder.parse(FileAccess.get_file_as_string(path)) != OK:
		return {}
	var parsed: Variant = decoder.data
	if not parsed is Dictionary or not _valid_integer(parsed.get("schema"), 1, SCHEMA_VERSION) or not parsed.get("payload") is String:
		return {}
	var payload: String = parsed["payload"]
	if payload.sha256_text() != str(parsed.get("sha256", "")):
		return {}
	if decoder.parse(payload) != OK:
		return {}
	var data: Variant = decoder.data
	if not data is Dictionary or data.get("schema_version") != parsed["schema"]:
		return {}
	return _normalize_snapshot(data)

func save_game() -> bool:
	if save_path.is_empty():
		return false
	var absolute_path: String = ProjectSettings.globalize_path(save_path)
	if DirAccess.make_dir_recursive_absolute(absolute_path.get_base_dir()) != OK:
		return false
	var temporary: String = absolute_path + ".tmp"
	var backup: String = absolute_path + ".bak"
	var payload: String = JSON.stringify(export_snapshot(), "", true)
	var file: FileAccess = FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		message.emit("Unable to save adventure progress.")
		return false
	file.store_string(JSON.stringify({"schema": SCHEMA_VERSION, "payload": payload, "sha256": payload.sha256_text()}))
	file.flush()
	var write_error: Error = file.get_error()
	file.close()
	if write_error != OK or _decode_save(temporary).is_empty():
		DirAccess.remove_absolute(temporary)
		return false
	var rotated: bool = false
	if FileAccess.file_exists(absolute_path):
		if not _decode_save(absolute_path).is_empty():
			if FileAccess.file_exists(backup) and DirAccess.remove_absolute(backup) != OK:
				DirAccess.remove_absolute(temporary)
				return false
			if DirAccess.rename_absolute(absolute_path, backup) != OK:
				DirAccess.remove_absolute(temporary)
				return false
			rotated = true
		elif DirAccess.remove_absolute(absolute_path) != OK:
			DirAccess.remove_absolute(temporary)
			return false
	if DirAccess.rename_absolute(temporary, absolute_path) != OK:
		if rotated:
			DirAccess.rename_absolute(backup, absolute_path)
		DirAccess.remove_absolute(temporary)
		return false
	return true

func load_game() -> bool:
	for candidate: String in [save_path, save_path + ".bak"]:
		var data: Dictionary = _decode_save(candidate)
		if not data.is_empty() and restore_snapshot(data):
			if candidate.ends_with(".bak"):
				message.emit("Recovered adventure progress from the backup save.")
			return true
	return false

func _changed(inventory: bool) -> void:
	if inventory:
		inventory_changed.emit()
	progression_changed.emit()
	if auto_save_enabled and not save_game():
		message.emit("Progress could not be saved. Keep this session open until saving is restored.")

func _setup_audio() -> void:
	if _cue_player != null:
		return
	var synth: Node = AudioSynthScript.new()
	_cues = {"swing": synth._build_swing_wav(), "hurt": synth._build_impact_wav(), "guard": synth._build_block_wav(), "spell": synth._build_spell_wav()}
	_cues["pickup"] = _cues["spell"]
	synth.free()
	_cue_player = AudioStreamPlayer.new()
	_cue_player.max_polyphony = 3
	add_child(_cue_player)

func play_cue(id: String) -> void:
	if _cue_player == null or not is_inside_tree() or not _cues.has(id):
		return
	_cue_player.stream = _cues[id]
	_cue_player.volume_db = -15.0 if id in ["pickup", "spell"] else -12.0
	_cue_player.pitch_scale = 1.45 if id == "pickup" else 1.0
	_cue_player.play()
