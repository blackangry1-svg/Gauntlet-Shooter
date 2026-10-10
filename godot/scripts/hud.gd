class_name SoulsHUD
extends CanvasLayer

var HeroClassesScript = load("res:/" + "/scripts/hero_classes.gd")
var CitadelFloorsScript = load("res:/" + "/scripts/citadel_floors.gd")

var hp_bar: ProgressBar
var stamina_bar: ProgressBar
var mana_bar: ProgressBar
var class_label: Label
var weapon_label: Label
var estus_label: Label
var souls_label: Label
var floor_label: Label
var dread_bar: ProgressBar
var dread_label: Label
var taunt_label: Label
var boss_container: VBoxContainer
var boss_name_label: Label
var boss_hp_bar: ProgressBar
var ds4_guide_panel: PanelContainer
var death_screen_panel: ColorRect
var death_label: Label

var _taunt_timer: float = 0.0

func _ready() -> void:
	_create_ui_elements()
	_connect_global_signals()

func _create_ui_elements() -> void:
	# Top Left: Souls Stats (HP, Stamina, Mana)
	var stats_box = VBoxContainer.new()
	stats_box.position = Vector2(24, 20)
	stats_box.custom_minimum_size = Vector2(300, 110)
	add_child(stats_box)
	
	class_label = Label.new()
	class_label.text = "HERO: WARRIOR"
	stats_box.add_child(class_label)
	
	hp_bar = ProgressBar.new()
	hp_bar.custom_minimum_size = Vector2(300, 20)
	hp_bar.max_value = 150
	hp_bar.value = 150
	stats_box.add_child(hp_bar)
	
	stamina_bar = ProgressBar.new()
	stamina_bar.custom_minimum_size = Vector2(250, 14)
	stamina_bar.max_value = 100
	stamina_bar.value = 100
	stats_box.add_child(stamina_bar)
	
	mana_bar = ProgressBar.new()
	mana_bar.custom_minimum_size = Vector2(200, 12)
	mana_bar.max_value = 20
	mana_bar.value = 20
	stats_box.add_child(mana_bar)
	
	souls_label = Label.new()
	souls_label.text = "SOULS: 0"
	stats_box.add_child(souls_label)
	
	# Bottom Left: Weapon & Estus Flask
	var loadout_box = VBoxContainer.new()
	loadout_box.position = Vector2(24, 610)
	add_child(loadout_box)
	
	weapon_label = Label.new()
	weapon_label.text = "PRIMARY: Iron Broadsword"
	loadout_box.add_child(weapon_label)
	
	estus_label = Label.new()
	estus_label.text = "ESTUS FLASK: [3 / 3]"
	loadout_box.add_child(estus_label)
	
	# Top Center: Floor Title
	floor_label = Label.new()
	floor_label.text = "Floor 1: Icarus Beach Shoreline & Crypt of the Damned"
	floor_label.position = Vector2(360, 20)
	floor_label.custom_minimum_size = Vector2(560, 30)
	floor_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(floor_label)
	
	# Top Right: Dread Meter (Alien: Isolation Nemesis Stalker tension)
	var dread_box = VBoxContainer.new()
	dread_box.position = Vector2(980, 20)
	dread_box.custom_minimum_size = Vector2(260, 60)
	add_child(dread_box)
	
	dread_label = Label.new()
	dread_label.text = "DREAD METER (STALKER TENSION)"
	dread_box.add_child(dread_label)
	
	dread_bar = ProgressBar.new()
	dread_bar.max_value = 100
	dread_bar.value = 0
	dread_box.add_child(dread_bar)
	
	# Bottom Right: DualShock 4 & Keyboard Controls Guide Overlay
	ds4_guide_panel = PanelContainer.new()
	ds4_guide_panel.position = Vector2(930, 500)
	ds4_guide_panel.custom_minimum_size = Vector2(320, 200)
	var guide_vbox = VBoxContainer.new()
	var guide_title = Label.new()
	guide_title.text = "=== DUALSHOCK 4 CONTROLS ==="
	guide_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	guide_vbox.add_child(guide_title)
	
	var guide_text = Label.new()
	guide_text.text = "L-Stick: Move | L3: Sprint\nR-Stick: Look / Aim\nR1: Light Attack | R2: Heavy Stagger\nL1 / L2: Guard / Shield Block\nCircle / Space: Dodge Roll (iFrames)\nSquare / F: Estus Flask Heal\nTriangle / X: Switch Weapon\nCross / E: Interact / Bonfire\nD-Pad [ / ]: Switch Hero Class"
	guide_vbox.add_child(guide_text)
	ds4_guide_panel.add_child(guide_vbox)
	add_child(ds4_guide_panel)
	
	# Bottom Center: Dynamic Minotaur Taunts Subtitle
	taunt_label = Label.new()
	taunt_label.position = Vector2(250, 560)
	taunt_label.custom_minimum_size = Vector2(780, 40)
	taunt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	taunt_label.visible = false
	add_child(taunt_label)
	
	# Boss Health Bar (Top Screen)
	boss_container = VBoxContainer.new()
	boss_container.position = Vector2(340, 70)
	boss_container.custom_minimum_size = Vector2(600, 50)
	boss_container.visible = false
	add_child(boss_container)
	
	boss_name_label = Label.new()
	boss_name_label.text = "ASTERION, THE DOOMED PRINCE OF CRETE"
	boss_name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	boss_container.add_child(boss_name_label)
	
	boss_hp_bar = ProgressBar.new()
	boss_hp_bar.custom_minimum_size = Vector2(600, 24)
	boss_container.add_child(boss_hp_bar)
	
	# Fullscreen "YOU DIED" Death Overlay
	death_screen_panel = ColorRect.new()
	death_screen_panel.color = Color(0.12, 0.0, 0.0, 0.85)
	death_screen_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	death_screen_panel.visible = false
	
	death_label = Label.new()
	death_label.text = "YOU DIED\n\nRestoring at the Sacred Bonfire..."
	death_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	death_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	death_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	death_screen_panel.add_child(death_label)
	add_child(death_screen_panel)

func _connect_global_signals() -> void:
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton:
		global_singleton.floor_changed.connect(_on_floor_changed)
		global_singleton.dread_changed.connect(_on_dread_changed)
		global_singleton.taunt_emitted.connect(_on_taunt_emitted)
		global_singleton.boss_health_updated.connect(_on_boss_health_updated)
		global_singleton.boss_defeated.connect(_on_boss_defeated)
		global_singleton.hero_class_changed.connect(_on_hero_class_changed)
		global_singleton.player_died.connect(_on_player_died)
		global_singleton.player_respawned.connect(_on_player_respawned)
		global_singleton.aegis_acquired.connect(_on_aegis_acquired)

func _process(delta: float) -> void:
	if _taunt_timer > 0.0:
		_taunt_timer -= delta
		if _taunt_timer <= 0.0:
			taunt_label.visible = false
			
	var global_singleton = Engine.get_main_loop().root.get_node_or_null("Global")
	if global_singleton and souls_label != null:
		souls_label.text = "SOULS: " + str(global_singleton.player_souls)

func update_stats(hp: float, max_h: float, stam: float, max_s: float, mana: float, max_m: float) -> void:
	hp_bar.max_value = max_h
	hp_bar.value = hp
	stamina_bar.max_value = max_s
	stamina_bar.value = stam
	mana_bar.max_value = max_m
	mana_bar.value = mana

func update_weapon(w_name: String, is_primary: bool) -> void:
	weapon_label.text = ("PRIMARY: " if is_primary else "SECONDARY: ") + w_name

func update_estus(rem: int) -> void:
	estus_label.text = "ESTUS FLASK: [" + str(rem) + " / 3]"

func _on_hero_class_changed(new_class: int) -> void:
	var cdata = HeroClassesScript.get_class_data(new_class)
	class_label.text = "HERO: " + cdata["name"].to_upper()
	var w_name = cdata["primary_weapon"]["name"]
	weapon_label.text = "PRIMARY: " + w_name

func _on_aegis_acquired() -> void:
	weapon_label.text = "SECONDARY: Aegis of the Minotaur (DIVINE WARD)"

func _on_floor_changed(new_floor: int) -> void:
	if new_floor < CitadelFloorsScript.FLOOR_CONFIGS.size():
		floor_label.text = CitadelFloorsScript.FLOOR_CONFIGS[new_floor]["name"]

func _on_dread_changed(dread: float) -> void:
	dread_bar.value = dread
	if dread > 70.0:
		dread_label.text = "CRITICAL DREAD - STALKER IS HUNTING!"
	elif dread > 30.0:
		dread_label.text = "DREAD - STALKER IS SEARCHING NEARBY..."
	else:
		dread_label.text = "DREAD METER (STALKER TENSION)"

func _on_taunt_emitted(speaker: String, text: String) -> void:
	taunt_label.text = speaker + ": \"" + text + "\""
	taunt_label.visible = true
	_taunt_timer = 4.5

func _on_boss_health_updated(b_name: String, cur_hp: float, max_hp: float) -> void:
	boss_container.visible = (cur_hp > 0.0)
	boss_name_label.text = b_name
	boss_hp_bar.max_value = max_hp
	boss_hp_bar.value = cur_hp

func _on_boss_defeated(_b_name: String) -> void:
	boss_container.visible = false

func _on_player_died() -> void:
	death_screen_panel.visible = true

func _on_player_respawned() -> void:
	death_screen_panel.visible = false
