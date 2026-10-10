extends SceneTree

const DirectorScript = preload("res:/" + "/scripts/adventure_director.gd")
const EnemyScript = preload("res:/" + "/scripts/adventure_enemy.gd")
const BossScript = preload("res:/" + "/scripts/adventure_boss.gd")
const StateScript = preload("res:/" + "/scripts/adventure_state.gd")
const FriendlyShotScript = preload("res:/" + "/scripts/adventure_projectile.gd")
var passed: int = 0
var failed: int = 0
var stage: Node3D
var director: Node
var adventure: Node
var player: Node
var world: Node

class FakePlayer extends CharacterBody3D:
	var hp: float = 500.0
	var hits: int = 0
	func _ready() -> void:
		collision_layer = 4
		collision_mask = 1
		add_to_group("player")
		var shape = CollisionShape3D.new()
		var capsule = CapsuleShape3D.new()
		capsule.radius = 0.35
		capsule.height = 1.6
		shape.shape = capsule
		shape.position.y = 0.8
		add_child(shape)
	func take_damage(amount: float, _source: Vector3 = Vector3.ZERO) -> void:
		hp -= amount
		hits += 1

class SecretFeature extends StaticBody3D:
	var adventure: Node
	var hits: int = 0
	func _ready() -> void:
		collision_layer = 8
		collision_mask = 0
		var shape = CollisionShape3D.new()
		var box = BoxShape3D.new()
		box.size = Vector3(0.45, 0.45, 0.45)
		shape.shape = box
		add_child(shape)
	func hit_weapon(weapon_id: String) -> void:
		if weapon_id == "staff":
			hits += 1
			adventure.set_flag(0, "hidden_guardian_awake")

class FakeWorld extends Node3D:
	var extra_block: Vector2i = Vector2i(-1, -1)
	func world_to_cell(point: Vector3) -> Vector2i:
		return Vector2i(roundi(point.x / 3.0), roundi(point.z / 3.0))
	func cell_to_world(cell: Vector2i) -> Vector3:
		return Vector3(cell.x * 3.0, 0.15, cell.y * 3.0)
	func is_walkable(cell: Vector2i) -> bool:
		return cell.x >= 1 and cell.y >= 1 and cell.x <= 5 and cell.y <= 5 and not (cell.x == 3 and cell.y <= 4) and cell != extra_block
	func get_map_data() -> Dictionary:
		return {"size": 7}
	func get_floor_spec(_index: int) -> Dictionary:
		var spawns: Array = []
		for cell in [Vector2i(5,1), Vector2i(5,2), Vector2i(5,3), Vector2i(5,4), Vector2i(4,1), Vector2i(4,2), Vector2i(4,3), Vector2i(4,4), Vector2i(5,5)]:
			spawns.append({"position": cell_to_world(cell), "id": "barrow_knight"})
		spawns[7]["hidden"] = true
		spawns[7]["unlock_flag"] = "hidden_guardian_awake"
		return {"enemy_spawns": spawns, "boss_spawn": cell_to_world(Vector2i(5,5))}

class SnapshotWorld extends Node3D:
	var extra_block: Vector2i = Vector2i(-1, -1)
	var walkability_calls: int = 0
	func world_to_cell(point: Vector3) -> Vector2i:
		return Vector2i(roundi(point.x / 3.0), roundi(point.z / 3.0))
	func cell_to_world(cell: Vector2i) -> Vector3:
		return Vector3(cell.x * 3.0, 0.15, cell.y * 3.0)
	func get_map_data() -> Dictionary:
		return {"size":7}
	func is_walkable(cell: Vector2i) -> bool:
		walkability_calls += 1
		return cell.x >= 1 and cell.y >= 1 and cell.x <= 5 and cell.y <= 5 and not (cell.x == 3 and cell.y <= 4) and cell != extra_block
	func get_navigation_data() -> Dictionary:
		var grid: Array[String] = ["#######", "#..#..#", "#..#..#", "#..#..#", "#..#..#", "#.....#", "#######"]
		var blocked: Dictionary = {}
		if extra_block.x >= 0:
			blocked[extra_block] = true
		return {"grid":grid, "blocked":blocked, "size":7, "revision":1 if extra_block.x >= 0 else 0}

func _initialize() -> void:
	call_deferred("_run")

func check(label: String, condition: bool) -> void:
	if condition:
		passed += 1
		print("PASS ", label)
	else:
		failed += 1
		push_error("FAIL " + label)

func _wall(position_value: Vector3, size: Vector3) -> void:
	var wall = StaticBody3D.new()
	wall.collision_layer = 1
	var shape = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = size
	shape.shape = box
	wall.add_child(shape)
	wall.position = position_value
	stage.add_child(wall)

func _actor(position_value: Vector3, data: Dictionary = {}) -> Node:
	var actor = EnemyScript.new()
	var profile: Dictionary = {"hp": 100.0, "speed": 2.0, "range": 2.1, "color": Color.GRAY}
	profile.merge(data, true)
	actor.configure(director, profile)
	actor.position = position_value
	stage.add_child(actor)
	return actor

func _run() -> void:
	stage = Node3D.new()
	root.add_child(stage)
	adventure = StateScript.new()
	adventure.auto_save_enabled = false
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--adventure-save="):
			adventure.save_path = argument.trim_prefix("--adventure-save=") + ".combat"
	stage.add_child(adventure)
	adventure.new_game()
	player = FakePlayer.new()
	player.position = Vector3(3, 0.15, 3)
	stage.add_child(player)
	world = FakeWorld.new()
	stage.add_child(world)
	_wall(Vector3(9, -0.5, 9), Vector3(24, 1, 24))
	for z in [3.0, 6.0, 9.0, 12.0]:
		_wall(Vector3(9, 1.5, z), Vector3(3, 3, 3))
	director = DirectorScript.new()
	director.configure(adventure, world, player)
	stage.add_child(director)
	director.load_floor(0)
	director.set_physics_process(false)
	await physics_frame
	await physics_frame
	check("load caps regular spawns at eight", director.enemies.size() == 8)
	check("only one boss", get_nodes_in_group("adventure_boss").size() == 1)
	check("boss collider fits three metre corridors", director.boss._shape.shape.radius * 2.0 + 0.4 < 3.0)
	director._build_flow(Vector2i(1,1))
	check("shared flow reaches far branch", director._flow.has(Vector2i(5,1)))
	check("flow routes around maze wall", int(director._flow[Vector2i(5,1)]) == 12)
	var step: Vector3 = director.navigation_target(Vector3(15, 0.15, 3))
	check("next route step is walkable", world.is_walkable(world.world_to_cell(step)))
	world.extra_block = Vector2i(4,1)
	director._build_flow(Vector2i(1,1))
	check("closed door excluded from flow", not director._flow.has(Vector2i(4,1)))
	world.extra_block = Vector2i(-1,-1)
	director._build_flow(Vector2i(1,1))
	var snapshot_world = SnapshotWorld.new()
	stage.add_child(snapshot_world)
	director.world = snapshot_world
	director._build_flow(Vector2i(1,1))
	check("snapshot BFS reaches same maze branch", director._flow.has(Vector2i(5,1)) and int(director._flow[Vector2i(5,1)]) == 12)
	check("snapshot BFS avoids per-neighbor world queries", snapshot_world.walkability_calls == 0)
	var build_count: int = director._flow_build_count
	director._physics_process(0.1)
	check("unchanged navigation revision reuses route field", director._flow_build_count == build_count)
	snapshot_world.extra_block = Vector2i(4,1)
	director._physics_process(0.1)
	check("navigation revision rebuilds blocked route", not director._flow.has(Vector2i(4,1)) and director._flow_build_count == build_count + 1)
	check("flow timing telemetry records bounded build", director.performance_counts()["flow_build_usec"] >= 0)
	director.world = world
	director._build_flow(Vector2i(1,1))
	snapshot_world.queue_free()
	director._physics_process(0.1)
	check("regular activation capped", director.active_enemy_count() <= 8)
	check("hidden guardian invisible before secret", not director.enemies[7].visible and not director.enemies[7].awake)
	var hidden: Node = director.enemies[7]
	var hidden_hp: float = hidden.hp
	check("hidden guardian collision disabled before secret", hidden.collision_layer == 0)
	hidden.take_damage(999.0, 0.5, player.global_position)
	check("hidden guardian rejects damage before reveal", hidden.hp == hidden_hp)
	var secret_feature = SecretFeature.new()
	secret_feature.adventure = adventure
	secret_feature.position = hidden.position + Vector3.UP * 0.95
	stage.add_child(secret_feature)
	player.position = hidden.position + Vector3.BACK * 2.5
	await physics_frame
	var staff_shot = FriendlyShotScript.new()
	staff_shot.weapon_id = "staff"
	staff_shot.damage = 42.0
	staff_shot.stagger = 0.18
	staff_shot.speed = 22.0
	staff_shot.direction = Vector3.FORWARD
	staff_shot.source_position = player.global_position
	staff_shot.owner_actor = player
	staff_shot.blast_radius = 1.3
	staff_shot.remaining_life = 45.0 / 22.0
	staff_shot.position = player.position + Vector3.UP * 0.95
	stage.add_child(staff_shot)
	for i in range(20):
		await physics_frame
	check("real staff projectile reaches feature sharing hidden guardian cell", secret_feature.hits == 1 and adventure.has_flag(0, "hidden_guardian_awake"))
	check("hidden guardian ignores pre-reveal staff explosion", hidden.hp == hidden_hp)
	secret_feature.queue_free()
	player.position = Vector3(3, 0.15, 3)
	director._physics_process(0.1)
	check("hidden guardian activates after secret", director.enemies[7].visible and director.enemies[7].awake)
	check("revealed guardian restores enemy collision layer", hidden.collision_layer == 2)
	check("hidden guardian awards larger currency", int(director.enemies[7].profile["souls"]) == 75)
	var route_actor: Node = director.enemies[0]
	var route_start: Vector3 = route_actor.global_position
	var remained_walkable: bool = true
	for i in range(240):
		await physics_frame
		director._physics_process(1.0 / 60.0)
		remained_walkable = remained_walkable and world.is_walkable(world.world_to_cell(route_actor.global_position))
	check("physical actor advances around maze corner", route_actor.global_position.distance_to(route_start) > 4.0 and route_actor.global_position.z > route_start.z + 1.0)
	check("physical actor never crosses blocked maze cells", remained_walkable)
	for actor in director.enemies:
		actor.set_awake(false)
	director.boss.set_awake(false)
	var patterns: Array[String] = []
	for index in range(5):
		var boss = BossScript.new()
		boss.configure(director, {"hp": 300.0, "boss": true, "color": Color.GRAY}, index)
		boss.position = Vector3(6, 0.15, 6)
		stage.add_child(boss)
		player.position = Vector3(6, 0.15, 15)
		var attack: Dictionary = boss.choose_attack()
		patterns.append(str(attack["pattern"]))
		check("boss %d windup at least half second" % index, float(attack["tell"]) >= 0.5)
		boss.hp = 100.0
		check("boss %d phase two still telegraphed" % index, float(boss.choose_attack()["tell"]) >= 0.5)
		boss.queue_free()
	check("boss roles distinguish charge fan breath dive", patterns.slice(0,4) == ["charge", "fan", "breath", "dive"])
	await process_frame
	var enemy = _actor(Vector3(6, 0.15, 6))
	player.position = Vector3(12, 0.15, 6)
	enemy._attack = {"range": 10.0, "damage": 20.0}
	enemy._hit = false
	var before: float = player.hp
	enemy._try_hit_player(false)
	check("wall blocks melee and radial impacts", player.hp == before)
	player.position = Vector3(6, 0.15, 12)
	enemy._try_hit_player(false)
	check("clear impact damages player", player.hp == before - 20.0)
	enemy._try_hit_player(false)
	check("one attack cannot hit twice", player.hp == before - 20.0)
	player.position = Vector3(6, 0.15, 7)
	before = player.hp
	enemy.set_awake(true)
	enemy.begin_attack({"pattern":"melee", "range":2.1, "damage":15.0, "tell":0.7, "duration":0.18, "recovery":0.8})
	for i in range(31):
		await physics_frame
	check("actual windup does not deal early damage", player.hp == before and enemy.phase == enemy.Phase.WINDUP)
	for i in range(17):
		await physics_frame
	print("TIMING_READBACK ", JSON.stringify({"phase":enemy.phase,"timer":enemy._timer,"hp":player.hp,"expected":before-15.0,"enemy_position":str(enemy.global_position),"player_position":str(player.global_position)}))
	check("attack lands after its telegraph", player.hp == before - 15.0)
	check("attack has finite recovery window", enemy.phase in [enemy.Phase.ACTIVE, enemy.Phase.RECOVERY])
	enemy.set_awake(false)
	player.position = Vector3(12, 0.15, 6)
	before = player.hp
	check("projectile can spawn before wall", director.fire_projectile(enemy, Vector3.RIGHT, 10.0, 8.0, Color.ORANGE))
	await create_timer(0.4).timeout
	check("swept projectile stops at wall", player.hp == before and director.projectile_count() == 0)
	player.position = Vector3(6, 0.15, 12)
	check("clear projectile spawns", director.fire_projectile(enemy, Vector3.BACK, 10.0, 8.0, Color.ORANGE))
	await create_timer(0.8).timeout
	check("clear swept projectile hits player", player.hp == before - 10.0)
	for i in range(24):
		var dummy = Node3D.new()
		stage.add_child(dummy)
		dummy.add_to_group("adventure_projectile")
	check("combined friendly hostile cap denies twenty fifth", not director.fire_projectile(enemy, Vector3.BACK, 10.0, 8.0, Color.ORANGE))
	check("combined cap remains twenty four", director.projectile_count() == 24)
	for shot in get_nodes_in_group("adventure_projectile"):
		shot.queue_free()
	await process_frame
	for i in range(20):
		director.fire_projectile(enemy, Vector3.FORWARD, 10.0, 8.0, Color.ORANGE)
	check("hostile subpool capped at twelve", director.projectile_count() == 12)
	var guardian: Node = director.boss
	guardian.take_damage(guardian.max_hp + 1.0, 0.0, player.global_position)
	check("boss defeat flag persists", adventure.has_flag(0, "boss_defeated"))
	check("Earth boss grants bow and tide charm", adventure.has_item("bow") and adventure.has_item("tide_charm"))
	var reward_state: Dictionary = adventure.export_snapshot()
	guardian.take_damage(999.0)
	check("boss death reward occurs once", adventure.export_snapshot() == reward_state)
	director.load_floor(0)
	await process_frame
	check("defeated guardian stays absent on revisit", director.boss == null)
	check("floor change clears all projectiles", director.projectile_count() == 0)
	enemy.queue_free()
	stage.queue_free()
	await process_frame
	print("ADVENTURE_COMBAT_RESULT ", JSON.stringify({"passed":passed, "failed":failed}))
	quit(0 if failed == 0 else 1)
