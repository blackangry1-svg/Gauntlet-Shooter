extends Node

enum HeroClass {
	WARRIOR,
	ELF,
	WIZARD,
	VALKYRIE
}

enum CitadelFloor {
	BEACH_CRYPT = 0,
	SUNKEN_LABYRINTH = 1,
	MAGMA_FOUNDRY = 2,
	GALE_RAMPARTS = 3,
	CELESTIAL_CATHEDRAL = 4
}

signal hero_class_changed(new_class: HeroClass)
signal floor_changed(new_floor: CitadelFloor)
signal dread_changed(dread_value: float)
signal taunt_emitted(speaker: String, text: String)
signal aegis_acquired()
signal boss_health_updated(boss_name: String, current_hp: float, max_hp: float)
signal boss_defeated(boss_name: String)
signal player_died()
signal player_respawned()

var AudioSynthScript = load("res:/" + "/scripts/audio_synth.gd")

var current_hero_class: HeroClass = HeroClass.WARRIOR
var current_floor_index: CitadelFloor = CitadelFloor.BEACH_CRYPT
var player_souls: int = 0
var has_aegis_of_minotaur: bool = false
var dread_meter: float = 0.0
var is_in_sanctuary: bool = false
var active_bonfire_position: Vector3 = Vector3.ZERO
var audio_synth: Node = null

const FLOOR_NAMES = [
	"Floor 1: Icarus Beach Shoreline & Crypt of the Damned",
	"Floor 2: Sunken Aqueduct & The Labyrinth",
	"Floor 3: Magma Foundry & Abyssal Forge",
	"Floor 4: Gale Ramparts & Sky High Walkway",
	"Floor 5: Wizard King's Cathedral & Celestial Throne"
]

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	setup_ds4_and_keyboard_inputs()
	if AudioSynthScript:
		audio_synth = AudioSynthScript.new()
		add_child(audio_synth)

func setup_ds4_and_keyboard_inputs() -> void:
	_register_action("move_forward", [
		_create_key_event(KEY_W),
		_create_key_event(KEY_UP),
		_create_joy_axis_event(JOY_AXIS_LEFT_Y, -1.0)
	])
	_register_action("move_back", [
		_create_key_event(KEY_S),
		_create_key_event(KEY_DOWN),
		_create_joy_axis_event(JOY_AXIS_LEFT_Y, 1.0)
	])
	_register_action("move_left", [
		_create_key_event(KEY_A),
		_create_key_event(KEY_LEFT),
		_create_joy_axis_event(JOY_AXIS_LEFT_X, -1.0)
	])
	_register_action("move_right", [
		_create_key_event(KEY_D),
		_create_key_event(KEY_RIGHT),
		_create_joy_axis_event(JOY_AXIS_LEFT_X, 1.0)
	])
	_register_action("attack_light", [
		_create_mouse_button_event(MOUSE_BUTTON_LEFT),
		_create_joy_button_event(JOY_BUTTON_RIGHT_SHOULDER) # R1 on DS4
	])
	_register_action("attack_heavy", [
		_create_key_event(KEY_R),
		_create_mouse_button_event(MOUSE_BUTTON_RIGHT),
		_create_joy_axis_event(JOY_AXIS_TRIGGER_RIGHT, 1.0) # R2 on DS4
	])
	_register_action("block", [
		_create_key_event(KEY_Q),
		_create_joy_button_event(JOY_BUTTON_LEFT_SHOULDER), # L1 on DS4
		_create_joy_axis_event(JOY_AXIS_TRIGGER_LEFT, 1.0)  # L2 on DS4
	])
	_register_action("dodge", [
		_create_key_event(KEY_SPACE),
		_create_joy_button_event(JOY_BUTTON_B) # Circle on DS4
	])
	_register_action("heal", [
		_create_key_event(KEY_F),
		_create_joy_button_event(JOY_BUTTON_X) # Square on DS4
	])
	_register_action("interact", [
		_create_key_event(KEY_E),
		_create_joy_button_event(JOY_BUTTON_A) # Cross on DS4
	])
	_register_action("switch_weapon", [
		_create_key_event(KEY_X),
		_create_joy_button_event(JOY_BUTTON_Y) # Triangle on DS4
	])
	_register_action("sprint", [
		_create_key_event(KEY_SHIFT),
		_create_joy_button_event(JOY_BUTTON_LEFT_STICK) # L3 on DS4
	])
	_register_action("cycle_class_prev", [
		_create_key_event(KEY_BRACKETLEFT),
		_create_joy_button_event(JOY_BUTTON_DPAD_LEFT)
	])
	_register_action("cycle_class_next", [
		_create_key_event(KEY_BRACKETRIGHT),
		_create_joy_button_event(JOY_BUTTON_DPAD_RIGHT)
	])

func _register_action(action_name: String, events: Array) -> void:
	if not InputMap.has_action(action_name):
		InputMap.add_action(action_name, 0.2)
	for ev in events:
		if ev != null:
			InputMap.action_add_event(action_name, ev)

func _create_key_event(keycode: Key) -> InputEventKey:
	var ev = InputEventKey.new()
	ev.physical_keycode = keycode
	return ev

func _create_mouse_button_event(button_index: MouseButton) -> InputEventMouseButton:
	var ev = InputEventMouseButton.new()
	ev.button_index = button_index
	return ev

func _create_joy_button_event(btn: JoyButton) -> InputEventJoypadButton:
	var ev = InputEventJoypadButton.new()
	ev.button_index = btn
	return ev

func _create_joy_axis_event(axis: JoyAxis, value: float) -> InputEventJoypadMotion:
	var ev = InputEventJoypadMotion.new()
	ev.axis = axis
	ev.axis_value = value
	return ev

func select_hero(hero: HeroClass) -> void:
	current_hero_class = hero
	hero_class_changed.emit(hero)

func advance_floor() -> void:
	if int(current_floor_index) < CitadelFloor.CELESTIAL_CATHEDRAL:
		current_floor_index = (int(current_floor_index) + 1) as CitadelFloor
		floor_changed.emit(current_floor_index)

func set_dread(val: float) -> void:
	var mult = 0.25 if has_aegis_of_minotaur else 1.0
	dread_meter = clamp(val * mult, 0.0, 100.0)
	dread_changed.emit(dread_meter)

func acquire_aegis() -> void:
	has_aegis_of_minotaur = true
	aegis_acquired.emit()
	taunt_emitted.emit("AEGIS", "The sacred Aegis of the Minotaur is claimed! Fear has no hold over you!")

func trigger_rumble(weak: float, strong: float, duration: float) -> void:
	Input.start_joy_vibration(0, weak, strong, duration)
