extends CanvasLayer

var MapScript = load("res:/" + "/scripts/adventure_map.gd")
var state
var world
var player
var director
var root: Control
var title: Label
var objective: Label
var status: Label
var prompt: Label
var notice: Label
var health: ProgressBar
var stamina: ProgressBar
var boss_name: Label
var boss_health: ProgressBar
var mini
var full_map
var journal: PanelContainer
var inventory: Label
var menu: PanelContainer
var quality_button: Button
var fps_label: Label
var damage_flash: ColorRect
var discoveries: Dictionary = {}
var timer: float = 0.0
var notice_time: float = 0.0
var last_cell := Vector2i(-99, -99)
var last_reveal_radius: int = -1
var last_hp: float = 120.0
var quality_index: int = 1
var show_fps: bool = false
var shop: PanelContainer
var shop_list: VBoxContainer
var shop_title: Label
var save_status: Label
var refuge: PanelContainer
var refuge_summary: Label
var refuge_buttons: Dictionary = {}

func configure(s: Node, w: Node, p: Node, d: Node) -> void:
	state = s
	world = w
	player = p
	director = d
	director.boss_status.connect(_boss_status)
	director.set_quality_budget([8, 10, 12][quality_index])
	refresh_floor()

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	title = _label(Vector2(22, 16), Vector2(580, 28), 22)
	objective = _label(Vector2(22, 48), Vector2(650, 60), 15)
	objective.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status = _label(Vector2(22, -96), Vector2(680, 25), 16, true)
	health = _bar(Vector2(22, -63), Vector2(255, 13), Color(0.75, 0.23, 0.22))
	stamina = _bar(Vector2(22, -42), Vector2(255, 9), Color(0.34, 0.72, 0.44))
	prompt = _label(Vector2(-320, -115), Vector2(640, 34), 20)
	_place(prompt, Vector2(-320, -115), Vector2(640, 34), Control.PRESET_CENTER_BOTTOM)
	prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	notice = _label(Vector2(-360, 75), Vector2(720, 66), 17)
	_place(notice, Vector2(-220, 110), Vector2(440, 78), Control.PRESET_CENTER_TOP)
	notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	notice.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var controls := _label(Vector2(22, -23), Vector2(1000, 20), 12, true)
	controls.text = "WASD / sticks  •  LMB/R1 attack  RMB/△ heavy  Q/L1 guard  Space/○ dodge  E/× use  F/□ heal  1–5 gear  Tab map  Esc pause"
	mini = MapScript.new()
	mini.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	mini.position = Vector2(-226, 18)
	mini.size = Vector2(204, 204)
	root.add_child(mini)
	fps_label = _label(Vector2(-300, 231), Vector2(275, 48), 12)
	_place(fps_label, Vector2(-300, 231), Vector2(275, 48), Control.PRESET_TOP_RIGHT)
	var crosshair := _label(Vector2(-9, -10), Vector2(18, 22), 20)
	_place(crosshair, Vector2(-9, -10), Vector2(18, 22), Control.PRESET_CENTER)
	crosshair.text = "+"
	crosshair.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	boss_name = _label(Vector2(-300, -185), Vector2(600, 27), 19)
	_place(boss_name, Vector2(-300, -185), Vector2(600, 27), Control.PRESET_CENTER_BOTTOM)
	boss_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	boss_health = _bar(Vector2(-300, -151), Vector2(600, 10), Color(0.76, 0.27, 0.3))
	_place(boss_health, Vector2(-300, -151), Vector2(600, 10), Control.PRESET_CENTER_BOTTOM)
	boss_health.visible = false
	journal = _panel(Vector2(-410, -225), Vector2(820, 450))
	var row := HBoxContainer.new()
	journal.add_child(row)
	full_map = MapScript.new()
	full_map.custom_minimum_size = Vector2(410, 410)
	row.add_child(full_map)
	var inventory_scroll := ScrollContainer.new()
	inventory_scroll.custom_minimum_size = Vector2(370, 410)
	inventory_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(inventory_scroll)
	inventory = Label.new()
	inventory.custom_minimum_size = Vector2(330, 0)
	inventory.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inventory.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	inventory.add_theme_font_size_override("font_size", 16)
	inventory_scroll.add_child(inventory)
	journal.visible = false
	menu = _panel(Vector2(-185, -180), Vector2(370, 360))
	var column := VBoxContainer.new()
	menu.add_child(column)
	var heading := Label.new()
	heading.text = "THE ELEMENTAL TOWER"
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	heading.add_theme_font_size_override("font_size", 24)
	column.add_child(heading)
	_button(column, "Continue exploring", _toggle_pause)
	_button(column, "Save journey", _save_journey)
	quality_button = _button(column, "Quality: balanced (75%, 60 FPS)", _cycle_quality)
	_button(column, "Show performance (F9)", func(): show_fps = not show_fps)
	_button(column, "Save and quit", _save_and_quit)
	var hint := Label.new()
	hint.text = "Rest at a refuge to heal and replenish limited ammunition.\nKeys and passages persist when you revisit floors."
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(hint)
	save_status = Label.new()
	save_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(save_status)
	menu.visible = false
	shop = _panel(Vector2(-245, -235), Vector2(490, 470))
	var shop_column := VBoxContainer.new()
	shop.add_child(shop_column)
	shop_title = Label.new()
	shop_title.add_theme_font_size_override("font_size", 21)
	shop_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	shop_column.add_child(shop_title)
	var shop_scroll := ScrollContainer.new()
	shop_scroll.custom_minimum_size = Vector2(450, 350)
	shop_column.add_child(shop_scroll)
	shop_list = VBoxContainer.new()
	shop_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shop_scroll.add_child(shop_list)
	_button(shop_column, "Return to the labyrinth", _close_shop)
	shop.visible = false
	refuge = _panel(Vector2(-250, -210), Vector2(500, 420))
	var refuge_column := VBoxContainer.new()
	refuge.add_child(refuge_column)
	refuge_summary = Label.new()
	refuge_summary.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	refuge_summary.custom_minimum_size = Vector2(460, 180)
	refuge_summary.add_theme_font_size_override("font_size", 19)
	refuge_column.add_child(refuge_summary)
	for attribute: String in ["strength", "dexterity", "focus"]:
		refuge_buttons[attribute] = _button(refuge_column, attribute.capitalize(), _buy_level.bind(attribute))
	_button(refuge_column, "Return to the labyrinth", _close_refuge)
	refuge.visible = false
	damage_flash = ColorRect.new()
	damage_flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	damage_flash.color = Color(0.8, 0.05, 0.03, 0)
	damage_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(damage_flash)

func _place(control: Control, position_value: Vector2, dimensions: Vector2, preset: int) -> void:
	control.set_anchors_and_offsets_preset(preset)
	control.offset_left = position_value.x
	control.offset_top = position_value.y
	control.offset_right = position_value.x + dimensions.x
	control.offset_bottom = position_value.y + dimensions.y

func _label(position_value: Vector2, dimensions: Vector2, font: int, bottom: bool = false) -> Label:
	var label := Label.new()
	if bottom:
		label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	label.position = position_value
	label.size = dimensions
	label.add_theme_font_size_override("font_size", font)
	label.add_theme_color_override("font_color", Color(0.93, 0.94, 0.91))
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(label)
	return label

func _bar(position_value: Vector2, dimensions: Vector2, color: Color) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	bar.position = position_value
	bar.size = dimensions
	bar.show_percentage = false
	bar.add_theme_font_size_override("font_size", 1)
	var background := StyleBoxFlat.new()
	background.bg_color = Color(0.06, 0.08, 0.11, 0.9)
	bar.add_theme_stylebox_override("background", background)
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	bar.add_theme_stylebox_override("fill", fill)
	root.add_child(bar)
	_place(bar, position_value, dimensions, Control.PRESET_BOTTOM_LEFT)
	return bar

func _panel(position_value: Vector2, dimensions: Vector2) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	panel.position = position_value
	panel.size = dimensions
	var background := StyleBoxFlat.new()
	background.bg_color = Color(0.035, 0.047, 0.075, 0.97)
	background.content_margin_left = 16
	background.content_margin_right = 16
	background.content_margin_top = 16
	background.content_margin_bottom = 16
	panel.add_theme_stylebox_override("panel", background)
	root.add_child(panel)
	return panel

func _button(parent: Node, text: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(300, 43)
	button.pressed.connect(action)
	parent.add_child(button)
	return button

func _input(event: InputEvent) -> void:
	if state == null:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			_toggle_pause()
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_TAB:
			refuge.visible = false
			shop.visible = false
			journal.visible = not journal.visible
			menu.visible = false
			get_tree().paused = journal.visible
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if journal.visible else Input.MOUSE_MODE_CAPTURED
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_F5:
			_save_journey()
		elif event.keycode == KEY_F9:
			show_fps = not show_fps
	elif event is InputEventJoypadButton and event.pressed:
		if event.button_index == JOY_BUTTON_START:
			_toggle_pause()
		elif event.button_index == JOY_BUTTON_BACK:
			refuge.visible = false
			shop.visible = false
			menu.visible = false
			journal.visible = not journal.visible
			get_tree().paused = journal.visible
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if journal.visible else Input.MOUSE_MODE_CAPTURED

func _toggle_pause() -> void:
	if refuge.visible:
		_close_refuge()
		return
	if shop.visible:
		_close_shop()
		return
	journal.visible = false
	menu.visible = not menu.visible
	get_tree().paused = menu.visible
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if menu.visible else Input.MOUSE_MODE_CAPTURED

func _cycle_quality() -> void:
	quality_index = (quality_index + 1) % 3
	var scale: float = [0.6, 0.75, 1.0][quality_index]
	get_viewport().scaling_3d_scale = scale
	Engine.max_fps = 45 if quality_index == 0 else 60
	director.set_quality_budget([8, 10, 12][quality_index])
	quality_button.text = ["Quality: low power (60%, 45 FPS)", "Quality: balanced (75%, 60 FPS)", "Quality: native (100%, 60 FPS)"][quality_index]

func show_message(text: String) -> void:
	notice.text = text
	notice_time = 6.0

func refresh_floor() -> void:
	if world == null:
		return
	last_cell = Vector2i(-99, -99)
	if not discoveries.has(state.current_floor):
		discoveries[state.current_floor] = {}
	var data: Dictionary = world.get_map_data()
	mini.map_data = data
	full_map.map_data = data
	var spec: Dictionary = world.get_floor_spec(state.current_floor)
	title.text = str(state.current_floor + 1) + " / 5  •  " + str(spec.get("name", "Labyrinth"))

func _process(delta: float) -> void:
	notice_time = maxf(0, notice_time - delta)
	notice.visible = notice_time > 0
	damage_flash.color.a = maxf(0, damage_flash.color.a - delta * 0.9)
	timer -= delta
	if timer > 0 or state == null or player == null:
		return
	timer = 0.1
	health.max_value = player.max_hp
	health.value = player.hp
	stamina.max_value = player.max_stamina
	stamina.value = player.stamina
	if player.hp < last_hp:
		damage_flash.color.a = 0.19
	last_hp = player.hp
	var weapon: String = str(state.equipped_weapon)
	var ammo: String = ""
	if weapon == "bow":
		ammo = " • " + str(state.arrows) + " arrows"
	elif weapon == "staff":
		ammo = " • " + str(state.staff_charges) + " charges"
	status.text = "Lv " + str(state.hero_level) + " • XP " + str(state.experience) + "/" + str(state.level_up_cost()) + "  |  " + str(state.weapon_def(weapon).get("name", weapon.capitalize())) + " • Tier " + str(state.tool_level(weapon)) + ammo + "  |  Flasks " + str(player.flasks) + "  |  Embers " + str(state.souls)
	objective.text = _objective()
	prompt.text = str(player.get_interaction_prompt())
	_update_map()
	var count: int = director.active_enemy_count()
	fps_label.visible = show_fps
	fps_label.text = str(Engine.get_frames_per_second()) + " FPS  •  CPU " + str(snappedf(Performance.get_monitor(Performance.TIME_PROCESS) * 1000, 0.1)) + " ms\n" + str(count) + " active enemies  •  " + str(director.projectile_count()) + " projectiles"
	if journal.visible:
		var text := "HERO LEVEL " + str(state.hero_level) + "  •  XP " + str(state.experience) + "/" + str(state.level_up_cost()) + "\nSTR " + str(state.attribute_value("strength")) + "  DEX " + str(state.attribute_value("dexterity")) + "  FOCUS " + str(state.attribute_value("focus")) + "\nRest at a refuge to raise one attribute.\n\nARSENAL & RELICS\n\n"
		for id in ["driftwood", "sword", "bow", "staff", "spear"]:
			text += (id.capitalize() + " • Tier " + str(state.tool_level(id)) + (" • Ready" if state.can_equip(id) else " • Stat locked") if state.has_item(id) else "Unfound weapon") + "\n"
			if state.has_item(id):
				text += _requirement_text(id) + "\n"
		text += "\nUTILITIES\n"
		for id in ["buckler", "tide_charm", "ember_sigil", "gale_mantle", "aether_sight", "sun_seal", "moon_seal"]:
			if state.has_item(id):
				var tier_text: String = " • Tier " + str(state.tool_level(id)) if id in ["buckler", "tide_charm", "ember_sigil", "gale_mantle", "aether_sight"] else ""
				text += id.replace("_", " ").capitalize() + tier_text + "\n"
		inventory.text = text + "\n" + _objective() + "\n\nVisited passages are mapped; secret branches still need exploration."

func map_reveal_radius() -> int:
	if not state.has_item("aether_sight"):
		return 2
	return 2 + state.tool_level("aether_sight")

func _update_map() -> void:
	var radius: int = map_reveal_radius()
	var cell: Vector2i = world.world_to_cell(player.global_position)
	var seen: Dictionary = discoveries.get(state.current_floor, {})
	if cell != last_cell or radius != last_reveal_radius:
		for y in range(-radius, radius + 1):
			for x in range(-radius, radius + 1):
				seen[cell + Vector2i(x, y)] = true
		discoveries[state.current_floor] = seen
		last_cell = cell
		last_reveal_radius = radius
		var data: Dictionary = world.get_map_data()
		mini.map_data = data
		full_map.map_data = data
	mini.seen = seen
	full_map.seen = seen
	mini.player_cell = cell
	full_map.player_cell = cell
	mini.heading = player.rotation.y
	full_map.heading = player.rotation.y
	mini.queue_redraw()
	if journal.visible:
		full_map.queue_redraw()

func _objective() -> String:
	var floor: int = state.current_floor
	if state.has_item("tower_heart"):
		return "The tower heart is restored. Every floor remains open for missed secrets and upgrades."
	if state.has_flag(3, "boss_defeated") and not (state.has_item("sun_seal") and state.has_item("moon_seal")):
		return "Return to Earth with the staff for the Sun Seal, and Fire with the spear for the Moon Seal."
	if state.has_flag(floor, "boss_defeated"):
		return "Guardian defeated. Explore sealed branches, visit the merchant, or use the lift to continue."
	if not state.has_flag(floor, "key_collected"):
		if floor == 1:
			return "Find the dive station. The Tide Charm lets you descend for the submerged key."
		return "Explore branching corridors for this floor's key. Refuge lifts allow return journeys."
	if not state.has_flag(floor, "gate_open"):
		return "You hold the local key. Find its sealed gate and open the deeper maze."
	if floor == 2 and not state.has_flag(floor, "bridge_lowered"):
		return "Aim the bow at the elevated chain ring. Its lever lowers the bridge across lava."
	if floor == 3 and not state.has_flag(floor, "wind_open"):
		return "Use the Gale Mantle at the storm barrier to enter the deeper maze."
	if floor == 4 and not state.has_flag(floor, "arcane_open"):
		return "Aether Sight reveals the true passage beyond this floor's key gate."
	return "The deeper maze is open. Locate the return lever and defeat its elemental guardian."

func _boss_status(name_value: String, hp: float, maximum: float) -> void:
	boss_name.text = name_value
	boss_health.max_value = maximum
	boss_health.value = hp
	var in_sight: bool = maximum > 0 and hp > 0 and is_instance_valid(director.boss)
	if in_sight:
		var target: Vector3 = director.boss.global_position + Vector3(0, 1.6, 0)
		in_sight = player.global_position.distance_to(director.boss.global_position) < 18.0 and director.has_cover_clear(player.camera.global_position, target)
	boss_health.visible = in_sight
	boss_name.visible = boss_health.visible

func _save_journey() -> bool:
	var saved: bool = state.save_game()
	var result: String = "Journey saved." if saved else "Save failed. Your journey is still open; please retry."
	save_status.text = result
	show_message(result)
	return saved

func _save_and_quit() -> void:
	if _save_journey():
		get_tree().quit()

func show_merchant() -> void:
	refuge.visible = false
	menu.visible = false
	journal.visible = false
	shop.visible = true
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_refresh_shop()

func _close_shop() -> void:
	shop.visible = false
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _refresh_shop() -> void:
	for child in shop_list.get_children():
		shop_list.remove_child(child)
		child.queue_free()
	shop_title.text = "CAPTIVE TOWER SMITH  •  " + str(state.souls) + " Embers"
	for id: String in ["driftwood", "sword", "bow", "staff", "spear", "buckler", "tide_charm", "ember_sigil", "gale_mantle", "aether_sight"]:
		if not state.has_item(id):
			continue
		var cost: int = state.upgrade_cost(id)
		var caption: String = id.replace("_", " ").capitalize() + "  •  Tier " + str(state.tool_level(id))
		caption += "  →  " + str(cost) + " Embers" if cost > 0 else "  •  Fully improved"
		var button: Button = _button(shop_list, caption, _buy_upgrade.bind(id))
		button.disabled = cost <= 0 or state.souls < cost

func _buy_upgrade(id: String) -> void:
	if state.upgrade_tool(id):
		show_message(id.replace("_", " ").capitalize() + " improved.")
	else:
		show_message("More Embers are needed, or this tool is fully improved.")
	_refresh_shop()

func _requirement_text(id: String) -> String:
	var requirements: Dictionary = state.weapon_requirements(id)
	var parts: PackedStringArray = []
	for attribute: String in requirements:
		parts.append(attribute.capitalize() + " " + str(requirements[attribute]))
	return "Requires " + ", ".join(parts) if not parts.is_empty() else "No attribute requirement"

func show_refuge() -> void:
	menu.visible = false
	shop.visible = false
	journal.visible = false
	refuge.visible = true
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_refresh_refuge()

func _close_refuge() -> void:
	refuge.visible = false
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _refresh_refuge() -> void:
	refuge_summary.text = "REFUGE • LEVEL " + str(state.hero_level) + "\nXP " + str(state.experience) + " / " + str(state.level_up_cost()) + " to level\nStrength " + str(state.attribute_value("strength")) + " • Dexterity " + str(state.attribute_value("dexterity")) + " • Focus " + str(state.attribute_value("focus")) + "\n\nChoose one attribute per level. Weapons and relics stay with you."
	for attribute: String in refuge_buttons:
		var button: Button = refuge_buttons[attribute]
		button.text = "Raise " + attribute.capitalize() + " to " + str(state.attribute_value(attribute) + 1)
		button.disabled = not state.can_level_up()

func _buy_level(attribute: String) -> void:
	if state.level_up(attribute):
		player.rest_at_checkpoint()
		show_message("Level " + str(state.hero_level) + " • " + attribute.capitalize() + " increased.")
	_refresh_refuge()
