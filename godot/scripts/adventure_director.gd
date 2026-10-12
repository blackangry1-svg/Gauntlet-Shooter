class_name AdventureDirector
extends Node3D

signal boss_status(name: String, hp: float, max_hp: float)
signal message(text: String)

const EnemyScript = preload("res:/" + "/scripts/adventure_enemy.gd")
const BossScript = preload("res:/" + "/scripts/adventure_boss.gd")
const ShotScript = preload("res:/" + "/scripts/adventure_hostile_projectile.gd")
const MAX_REGULAR: int = 8
const MAX_EARTH_POPULATION: int = 25
const CARDINALS: Array[Vector2i] = [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]
const MAX_PROJECTILES: int = 24
const MAX_HOSTILE: int = 12
const BOSS_NAMES: Array[String] = ["Stonehart Regent", "Abbess of the Tide", "Bellows Wyrm", "Roc of the Broken Sky", "Magister of Glass"]
const BOSS_HP: Array[float] = [360.0, 420.0, 500.0, 560.0, 640.0]
const COLORS: Array[Color] = [Color(0.42, 0.46, 0.29), Color(0.22, 0.49, 0.61), Color(0.64, 0.23, 0.12), Color(0.25, 0.39, 0.61), Color(0.48, 0.29, 0.65)]

var state: Node
var world: Node
var player: Node
var enemies: Array = []
var boss: Node
var current_floor: int = 0
var stress_awake: bool = false
var earth_awake_budget: int = 10
var _earth_trial: bool = false
var _refuge_active: bool = false
var _ai_usec: int = 0
var _ai_max_usec: int = 0
var _separation_pairs: int = 0
var _cap_denied: int = 0
var _regular_peak: int = 0
var _rewarded_actors: Dictionary = {}
var _flow_goal_cell: Vector2i = Vector2i(-999, -999)
var _think_timer: float = 0.0
var _flow_age: float = 1.0
var _flow: Dictionary = {}
var _target_cell: Vector2i = Vector2i(-999, -999)
var _materials: Dictionary = {}
var _ai_ticks: int = 0
var _nav_grid: Array = []
var _nav_blocked: Dictionary = {}
var _nav_size: int = 31
var _using_snapshot: bool = false
var _flow_revision: int = -1
var _flow_build_count: int = 0
var _flow_build_usec: int = 0
var _flow_build_max_usec: int = 0

func configure(adventure_state: Node, adventure_world: Node, adventure_player: Node) -> void:
	state = adventure_state
	world = adventure_world
	player = adventure_player

func set_quality_budget(value: int) -> void:
	earth_awake_budget = [8, 10, 12][clampi(value, 0, 2)] if value <= 2 else (8 if value <= 8 else (10 if value <= 10 else 12))
	if _earth_trial and is_inside_tree():
		_update_earth_encounters()

func earth_trial_active() -> bool:
	return _earth_trial

func is_position_protected(position_value: Vector3) -> bool:
	return _earth_trial and world.has_method("is_safe_refuge") and world.is_safe_refuge(position_value)

func is_player_protected() -> bool:
	return is_instance_valid(player) and is_position_protected(player.global_position)

func hero_combat_rating() -> int:
	return int(state.get_combat_rating()) if state.has_method("get_combat_rating") else 1

func load_floor(index: int) -> void:
	for child in get_children():
		child.queue_free()
	for projectile in get_tree().get_nodes_in_group("adventure_projectile"):
		projectile.queue_free()
	enemies.clear()
	boss = null
	current_floor = clampi(index, 0, 4)
	_earth_trial = current_floor == 0 and world.has_method("get_floor_metrics") and float(world.get_floor_metrics(0).get("cell_size", 3.0)) >= 8.0
	_refuge_active = false
	_regular_peak = 0
	_rewarded_actors.clear()
	_flow.clear()
	_target_cell = Vector2i(-999, -999)
	_flow_age = 1.0
	_flow_revision = -1
	_think_timer = 0.0
	var spec: Dictionary = world.get_floor_spec(current_floor)
	var spawns: Array = spec.get("enemy_spawns", [])
	for i in range(mini(MAX_EARTH_POPULATION if _earth_trial else MAX_REGULAR, spawns.size())):
		var entry: Variant = spawns[i]
		var data: Dictionary = entry if entry is Dictionary else {"position": entry}
		var id: String = str(data.get("id", "barrow_knight"))
		var actor = EnemyScript.new()
		var profile: Dictionary = profile_for(id, current_floor)
		if _earth_trial:
			profile["group_id"] = int(data.get("group_id", floori(float(i) / 3.0)))
			profile["combat_level"] = int(data.get("combat_level", 1))
			profile["lane_offset"] = data.get("lane_offset", Vector3.ZERO)
			profile["lane_index"] = i % 3 - 1
			profile["xp"] = 24
		if bool(data.get("hidden", false)):
			profile["hidden"] = true
			profile["unlock_flag"] = str(data.get("unlock_flag", "hidden_guardian_awake"))
			profile["hp"] = float(profile["hp"]) * 2.3
			profile["souls"] = 75
			profile["group_id"] = -1
			profile["xp"] = 72
		actor.configure(self, profile, current_floor)
		actor.position = data.get("position", Vector3.ZERO)
		add_child(actor)
		actor.defeated.connect(_on_defeated)
		enemies.append(actor)
	if not state.has_flag(current_floor, "boss_defeated"):
		var guardian = BossScript.new()
		guardian.configure(self, {"id": "boss_%d" % current_floor, "name": BOSS_NAMES[current_floor], "hp": BOSS_HP[current_floor], "boss": true, "speed": 2.0, "range": 14.0, "color": COLORS[current_floor]}, current_floor)
		guardian.position = spec.get("boss_spawn", Vector3.ZERO)
		add_child(guardian)
		guardian.add_to_group("adventure_boss")
		guardian.defeated.connect(_on_defeated)
		boss = guardian
	else:
		boss_status.emit("", 0.0, 0.0)

func _physics_process(delta: float) -> void:
	if not is_instance_valid(player) or not is_instance_valid(world):
		return
	_think_timer += delta
	_flow_age += delta
	if _think_timer < 0.1:
		return
	_think_timer = fmod(_think_timer, 0.1)
	_ai_ticks += 1
	var player_cell: Vector2i = world.world_to_cell(player.global_position)
	var snapshot: Dictionary = world.get_navigation_data() if world.has_method("get_navigation_data") else {}
	var revision: int = int(snapshot.get("revision", -1))
	if player_cell != _target_cell or (not snapshot.is_empty() and revision != _flow_revision) or (snapshot.is_empty() and _flow_age >= 0.5):
		_build_flow(player_cell, snapshot)
	if _earth_trial:
		var ai_started: int = Time.get_ticks_usec()
		_update_earth_encounters()
		_ai_usec = Time.get_ticks_usec() - ai_started
		_ai_max_usec = maxi(_ai_max_usec, _ai_usec)
		return
	var active_count: int = 0
	for actor in enemies:
		if not is_instance_valid(actor) or actor.hp <= 0.0:
			continue
		var revealed: bool = not bool(actor.profile.get("hidden", false)) or state.has_flag(current_floor, str(actor.profile.get("unlock_flag", "")))
		actor.set_revealed(revealed)
		var distance: float = actor.global_position.distance_to(player.global_position)
		var should_wake: bool = revealed and active_count < MAX_REGULAR and (stress_awake or distance < 25.0)
		actor.set_awake(should_wake)
		if should_wake:
			active_count += 1
			actor.think(0.1)
	if is_instance_valid(boss) and boss.hp > 0.0:
		boss.set_awake(stress_awake or boss.global_position.distance_to(player.global_position) < 28.0)
		boss.think(0.1)
		boss_status.emit(str(boss.profile.get("name", "Guardian")), boss.hp, boss.max_hp)

func _build_flow(target: Vector2i, supplied_snapshot: Dictionary = {}) -> void:
	var started: int = Time.get_ticks_usec()
	var snapshot: Dictionary = supplied_snapshot
	if snapshot.is_empty() and world.has_method("get_navigation_data"):
		snapshot = world.get_navigation_data()
	_using_snapshot = not snapshot.is_empty()
	_nav_grid = snapshot.get("grid", [])
	_nav_blocked = snapshot.get("blocked", {})
	_nav_size = int(snapshot.get("size", 31)) if _using_snapshot else int(world.get_map_data().get("size", 31))
	_flow_revision = int(snapshot.get("revision", -1))
	_target_cell = target
	_flow_age = 0.0
	_flow.clear()
	_flow_goal_cell = _resolve_flow_goal(target) if _earth_trial else target
	if _nav_is_walkable(_flow_goal_cell):
		var queue: Array[Vector2i] = [_flow_goal_cell]
		var head: int = 0
		_flow[_flow_goal_cell] = 0
		while head < queue.size():
			var cell: Vector2i = queue[head]
			head += 1
			for offset in CARDINALS:
				var neighbor: Vector2i = cell + offset
				if _flow.has(neighbor) or not _nav_is_walkable(neighbor):
					continue
				_flow[neighbor] = int(_flow[cell]) + 1
				queue.append(neighbor)
	_flow_build_count += 1
	_flow_build_usec = Time.get_ticks_usec() - started
	_flow_build_max_usec = maxi(_flow_build_max_usec, _flow_build_usec)

func _nav_is_walkable(cell: Vector2i) -> bool:
	if cell.x < 0 or cell.y < 0 or cell.x >= _nav_size or cell.y >= _nav_size:
		return false
	if not _using_snapshot:
		return world.is_walkable(cell)
	if cell.y >= _nav_grid.size() or cell.x >= str(_nav_grid[cell.y]).length():
		return false
	return str(_nav_grid[cell.y]).unicode_at(cell.x) != 35 and not _nav_blocked.has(cell)

func navigation_target(position_value: Vector3, actor: Node = null) -> Vector3:
	var cell: Vector2i = world.world_to_cell(position_value)
	if not _flow.has(cell):
		return position_value
	var best: Vector2i = cell
	var value: int = int(_flow[cell])
	for offset in CARDINALS:
		var candidate: Vector2i = cell + offset
		if _flow.has(candidate) and int(_flow[candidate]) < value and _nav_is_walkable(candidate):
			best = candidate
			value = int(_flow[candidate])
	var target: Vector3 = world.cell_to_world(best)
	if _earth_trial and is_instance_valid(actor):
		if best == cell:
			if has_cover_clear(position_value, player.global_position):
				target = player.global_position
		else:
			var center: Vector3 = world.cell_to_world(cell)
			var heading: Vector3 = (target - center).normalized()
			var side: Vector3 = Vector3(-heading.z, 0, heading.x)
			target = center + heading * 4.95 + side * float(actor.profile.get("lane_index", 0)) * 1.25
	target.y = position_value.y
	return target

func retreat_target(position_value: Vector3) -> Vector3:
	var cell: Vector2i = world.world_to_cell(position_value)
	var best: Vector2i = cell
	var value: int = int(_flow.get(cell, -1))
	for offset in CARDINALS:
		var candidate: Vector2i = cell + offset
		if _flow.has(candidate) and int(_flow[candidate]) > value and world.is_walkable(candidate):
			var point: Vector3 = world.cell_to_world(candidate)
			if has_cover_clear(position_value, point):
				best = candidate
				value = int(_flow[candidate])
	var result: Vector3 = world.cell_to_world(best)
	result.y = position_value.y
	return result

func has_cover_clear(from_position: Vector3, to_position: Vector3) -> bool:
	if not is_inside_tree():
		return false
	var query = PhysicsRayQueryParameters3D.create(from_position + Vector3.UP * 1.1, to_position + Vector3.UP * 1.1, 1)
	query.collide_with_areas = false
	return get_world_3d().direct_space_state.intersect_ray(query).is_empty()

func fire_projectile(source: Node, direction: Vector3, damage: float, speed: float, color: Color) -> bool:
	if is_player_protected():
		return false
	if projectile_count() >= MAX_PROJECTILES or get_tree().get_nodes_in_group("adventure_hostile_projectile").size() >= MAX_HOSTILE:
		return false
	var start: Vector3 = source.global_position + Vector3.UP * 1.25
	var muzzle: Vector3 = start + direction.normalized() * 0.9
	var query = PhysicsRayQueryParameters3D.create(start, muzzle, 1)
	if not get_world_3d().direct_space_state.intersect_ray(query).is_empty():
		return false
	var shot = ShotScript.new()
	shot.director = self
	shot.source = source
	shot.direction = direction.normalized()
	shot.damage = damage
	shot.speed = speed
	shot.color = color
	shot.position = muzzle
	add_child(shot)
	return true

func _on_defeated(actor: Node) -> void:
	var identity: int = actor.get_instance_id()
	if _rewarded_actors.has(identity):
		return
	_rewarded_actors[identity] = true
	if actor.is_boss:
		if not state.has_flag(current_floor, "boss_defeated"):
			state.defeat_boss(current_floor)
			message.emit("%s defeated. A new relic answers your oath." % BOSS_NAMES[current_floor])
		boss_status.emit("", 0.0, 0.0)
	else:
		var embers: int = int(actor.profile.get("souls", 12))
		var xp: int = int(actor.profile.get("xp", 24 + current_floor * 4))
		var ammo_rewards: Dictionary = {}
		if state.has_item("bow"):
			ammo_rewards["bow"] = 1
		if str(actor.profile.get("pattern", "")) == "ranged" and state.has_item("staff"):
			ammo_rewards["staff"] = 1
		if state.has_method("award_combat_reward"):
			state.award_combat_reward(embers, xp, ammo_rewards)
		else:
			var save_setting: Variant = state.get("auto_save_enabled")
			var persist: bool = bool(save_setting) if save_setting != null else true
			if save_setting != null:
				state.set("auto_save_enabled", false)
			state.souls += embers
			for weapon in ammo_rewards:
				state.add_ammo(weapon, int(ammo_rewards[weapon]))
			if save_setting != null:
				state.set("auto_save_enabled", persist)
			state.inventory_changed.emit()
			if persist:
				state.save_game()

func active_enemy_count() -> int:
	var count: int = 0
	for actor in enemies:
		if is_instance_valid(actor) and actor.hp > 0.0 and actor.awake:
			count += 1
	return count

func projectile_count() -> int:
	return get_tree().get_nodes_in_group("adventure_projectile").size() if is_inside_tree() else 0

func performance_counts() -> Dictionary:
	var pursuing: int = 0
	var fleeing: int = 0
	var groups: Dictionary = {}
	for actor in enemies:
		if is_instance_valid(actor) and actor.awake and actor.hp > 0.0:
			pursuing += 1 if actor.pursuing else 0
			fleeing += 1 if actor.fleeing else 0
			groups[int(actor.profile.get("group_id", -1))] = true
	return {"regular_peak": _regular_peak, "earth_trial": _earth_trial, "awake_budget": earth_awake_budget if _earth_trial else MAX_REGULAR, "pursuing": pursuing, "fleeing": fleeing, "groups_active": groups.size(), "cap_denied": _cap_denied, "ai_usec": _ai_usec, "ai_max_usec": _ai_max_usec, "separation_pairs": _separation_pairs, "regular_active": active_enemy_count(), "regular_total": enemies.size(), "bosses": 1 if is_instance_valid(boss) and boss.hp > 0.0 else 0, "projectiles": projectile_count(), "hostile_projectiles": get_tree().get_nodes_in_group("adventure_hostile_projectile").size(), "path_cells": _flow.size(), "ai_ticks": _ai_ticks, "flow_builds": _flow_build_count, "flow_build_usec": _flow_build_usec, "flow_build_max_usec": _flow_build_max_usec}


func _resolve_flow_goal(target: Vector2i) -> Vector2i:
	if _nav_is_walkable(target):
		return target
	var best: Vector2i = Vector2i(-999, -999)
	var nearest: float = INF
	for direction in CARDINALS:
		var candidate: Vector2i = target + direction
		if not _nav_is_walkable(candidate):
			continue
		var point: Vector3 = world.cell_to_world(candidate)
		var distance: float = point.distance_squared_to(player.global_position)
		if distance < nearest and has_cover_clear(player.global_position, point):
			best = candidate
			nearest = distance
	return best

func _within_hearing(first: Vector2i, second: Vector2i) -> bool:
	var delta: Vector2i = second - first
	var length: int = absi(delta.x) + absi(delta.y)
	if length > 2 or not _nav_is_walkable(first) or not _nav_is_walkable(second):
		return false
	if length <= 1:
		return true
	if delta.x == 0 or delta.y == 0:
		return _nav_is_walkable(first + Vector2i(signi(delta.x), signi(delta.y)))
	return _nav_is_walkable(first + Vector2i(delta.x, 0)) or _nav_is_walkable(first + Vector2i(0, delta.y))

func alert_from_damage(actor: Node) -> void:
	if not _earth_trial or not is_instance_valid(actor) or is_player_protected():
		return
	actor.alerted = true
	actor.pursuing = actor.is_boss or int(actor.profile.get("combat_level", 1)) > hero_combat_rating()
	_update_earth_encounters()

func _clear_refuge() -> void:
	for actor in enemies:
		if is_instance_valid(actor) and actor.hp > 0.0:
			actor.clear_hostile_intent()
			actor.set_awake(false)
	if is_instance_valid(boss) and boss.hp > 0.0:
		boss.clear_hostile_intent()
		boss.set_awake(false)
	for shot in get_tree().get_nodes_in_group("adventure_hostile_projectile"):
		shot.queue_free()
	_separation_pairs = 0
	_cap_denied = 0

func _update_earth_encounters() -> void:
	if is_player_protected() and not stress_awake:
		_refuge_active = true
		_clear_refuge()
		return
	_refuge_active = is_player_protected()
	var rating: int = hero_combat_rating()
	var candidates: Array = []
	var alerts: Array = []
	for actor in enemies:
		if not is_instance_valid(actor) or actor.hp <= 0.0:
			continue
		var revealed: bool = not bool(actor.profile.get("hidden", false)) or state.has_flag(current_floor, str(actor.profile.get("unlock_flag", "")))
		actor.set_revealed(revealed)
		var cell: Vector2i = world.world_to_cell(actor.global_position)
		var steps: int = int(_flow.get(cell, 99999))
		if not revealed or steps == 99999:
			actor.clear_hostile_intent()
			actor.set_awake(false)
			continue
		var level: int = int(actor.profile.get("combat_level", 1))
		actor.fleeing = rating >= level + 3
		if actor.fleeing or level <= rating:
			actor.pursuing = false
		var acquired: bool = steps <= 2 or (steps <= 4 and has_cover_clear(actor.global_position, player.global_position))
		if acquired:
			actor.alerted = true
			actor.pursuing = level > rating
		elif not actor.pursuing and steps > 6:
			actor.alerted = false
		if actor.alerted:
			alerts.append(actor)
	for actor in enemies:
		if not is_instance_valid(actor) or actor.hp <= 0.0 or not actor._revealed:
			continue
		var cell: Vector2i = world.world_to_cell(actor.global_position)
		if not _flow.has(cell):
			continue
		if not actor.alerted:
			for heard in alerts:
				var group: int = int(actor.profile.get("group_id", -1))
				if group >= 0 and group == int(heard.profile.get("group_id", -2)) and _within_hearing(cell, world.world_to_cell(heard.global_position)):
					actor.alerted = true
					actor.pursuing = int(actor.profile.get("combat_level", 1)) > rating
					break
		if actor.alerted or stress_awake:
			var priority: int = int(_flow[cell]) - (10000 if actor.pursuing else (100 if actor.awake else 0))
			candidates.append({"actor": actor, "priority": priority})
		else:
			actor.set_awake(false)
	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a["priority"]) < int(b["priority"]))
	var active: Array = []
	for i in range(candidates.size()):
		var actor: Node = candidates[i]["actor"]
		actor.set_awake(i < earth_awake_budget)
		if i < earth_awake_budget:
			active.append(actor)
	_cap_denied = maxi(0, candidates.size() - earth_awake_budget)
	_regular_peak = maxi(_regular_peak, active.size())
	_apply_separation(active)
	for actor in active:
		actor.think(0.1)
	if is_instance_valid(boss) and boss.hp > 0.0:
		var boss_cell: Vector2i = world.world_to_cell(boss.global_position)
		if not _flow.has(boss_cell):
			boss.clear_hostile_intent()
		elif int(_flow[boss_cell]) <= 6 or stress_awake:
			boss.alerted = true
			boss.pursuing = true
		boss.set_awake(boss.alerted and _flow.has(boss_cell))
		boss.think(0.1)
		boss_status.emit(str(boss.profile.get("name", "Guardian")), boss.hp, boss.max_hp)

func _apply_separation(active: Array) -> void:
	_separation_pairs = 0
	for actor in active:
		actor.separation = Vector3.ZERO
	for i in range(active.size()):
		for j in range(i + 1, active.size()):
			_separation_pairs += 1
			var first: Node = active[i]
			var second: Node = active[j]
			var offset: Vector3 = first.global_position - second.global_position
			offset.y = 0.0
			var distance: float = offset.length()
			if distance >= 1.15:
				continue
			var away: Vector3 = offset / distance if distance > 0.01 else Vector3.RIGHT.rotated(Vector3.UP, float(i) * 1.618)
			var force: Vector3 = away * (1.15 - distance) * 1.5
			first.separation += force
			second.separation -= force
	for actor in active:
		actor.separation = actor.separation.limit_length(1.5)

func material_for(color: Color, unshaded: bool = false) -> StandardMaterial3D:
	var key: String = color.to_html() + str(unshaded)
	if not _materials.has(key):
		var material = StandardMaterial3D.new()
		material.albedo_color = color
		material.roughness = 1.0
		if unshaded:
			material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_materials[key] = material
	return _materials[key]

func profile_for(id: String, stage: int) -> Dictionary:
	var result: Dictionary = {"id": id, "name": id.replace("_", " ").capitalize(), "hp": 65.0 + float(stage) * 12.0, "speed": 2.3, "damage": 15.0 + float(stage) * 2.0, "range": 2.2, "tell": 0.7, "recovery": 0.85, "pattern": "melee", "color": COLORS[clampi(stage, 0, 4)], "souls": 12}
	match id:
		"thornbound_revenant":
			result.merge({"range": 2.8, "speed": 2.0, "color": Color(0.38, 0.35, 0.17)}, true)
		"barrow_knight", "death_knight":
			result.merge({"hp": 105.0 + stage * 12.0, "tell": 0.95, "damage": 24.0, "speed": 1.8, "color": Color(0.31, 0.28, 0.35)}, true)
		"mire_hag", "ember_imp", "dark_acolyte", "skeleton_archer":
			result.merge({"pattern": "ranged", "range": 14.0, "hp": 55.0 + stage * 10.0, "speed": 1.9, "tell": 0.9, "recovery": 1.1}, true)
		"frost_wraith", "mirror_duelist":
			result.merge({"pattern": "charge", "range": 6.0, "speed": 2.8, "charge_speed": 5.3, "duration": 0.55, "tell": 0.75, "color": Color(0.45, 0.53, 0.7)}, true)
		"ash_zealot":
			result.merge({"range": 1.9, "speed": 2.7, "tell": 0.65, "color": Color(0.59, 0.28, 0.17)}, true)
		"storm_gargoyle", "moss_troll", "stone_golem", "lava_golem":
			result.merge({"pattern": "slam", "range": 3.1, "hp": 125.0 + stage * 15.0, "speed": 1.5, "tell": 1.0, "damage": 26.0, "recovery": 1.2, "height": 2.4}, true)
			if id in ["stone_golem", "storm_gargoyle"]:
				result["texture"] = "res:/" + "/assets/sprites/stone_golem.png"
		"tempest_harpy", "storm_harpy", "cave_spider", "death_bat":
			result.merge({"pattern": "dive", "range": 6.5, "speed": 2.9, "charge_speed": 6.0, "duration": 0.55, "tell": 0.8}, true)
			if id in ["tempest_harpy", "storm_harpy"]:
				result["texture"] = "res:/" + "/assets/sprites/storm_harpy.png"
		"rune_sentinel":
			result.merge({"pattern": "guard", "hp": 135.0 + stage * 14.0, "speed": 1.6, "tell": 1.0, "range": 2.6, "damage": 25.0, "height": 2.35, "texture": "res:/" + "/assets/sprites/stone_golem.png"}, true)
	if id == "cave_spider":
		result["collision_height"] = 0.95
	if id == "ember_imp":
		result["collision_height"] = 1.3
	return result
