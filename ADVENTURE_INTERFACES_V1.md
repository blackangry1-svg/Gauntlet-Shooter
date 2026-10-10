# Adventure implementation interfaces
Authority: OVERHAUL_BLUEPRINT_V1.md and current user's revised game vision.
Owner root: project.godot, adventure_main.gd, adventure_hud.gd, integration tests, settings and documentation.
Owner godot_contracts: adventure_state.gd, adventure_player.gd, own state/player tests.
Owner production_blueprint: adventure_world.gd, adventure_feature.gd, maze data/helpers and own topology tests.
Owner expanded_roster: adventure_enemy.gd, adventure_director.gd, adventure_boss.gd if useful and own encounter tests.
Keep legacy scripts intact for archived regression coverage; active main uses only the single-hero adventure modules.
Every code write is ratified through GEN9; never mutate another owner's files without coordinating.

## State autoload: Adventure
Fields: current_floor, checkpoint_floor, checkpoint_cell:Vector2i, equipped_weapon:String, arrows:int, staff_charges:int, souls:int.
Signals: inventory_changed, progression_changed, floor_changed(index:int), message(text:String).
new_game(); has_item(id:String)->bool; acquire_item(id:String)->void.
equip_weapon(id:String)->bool; cycle_weapon(direction:int)->void; consume_ammo(weapon:String)->bool.
add_ammo(weapon:String,amount:int); tool_level(id:String)->int; upgrade_tool(id:String)->bool.
has_flag(floor:int,id:String)->bool; set_flag(floor:int,id:String,value:bool=true)->void; floor_flags(floor:int)->Dictionary.
can_travel_to(floor:int)->bool; change_floor(floor:int)->bool; set_checkpoint(floor:int,cell:Vector2i).
defeat_boss(floor:int)->void grants rewards:0 bow+tide_charm;1 staff+ember_sigil;2 spear+gale_mantle;3 aether_sight;4 tower_heart.
Floor4 additionally needs sun_seal and moon_seal plus boss3. Other floors unlock from previous boss.
save_game()->bool; load_game()->bool; export_snapshot()->Dictionary; restore_snapshot(data:Dictionary)->bool.
save_path:String configurable; command-line --adventure-save=<absolute path> isolates tests from player saves.
Weapon ids driftwood,sword,bow,staff,spear. Item ids buckler,tide_charm,ember_sigil,gale_mantle,aether_sight,sun_seal,moon_seal,tower_heart.
Currency souls; use the name Embers in the interface.

## Unified player: AdventurePlayer
extends CharacterBody3D. configure(state:Node)->void; fields hp,max_hp,stamina,max_stamina,camera:Camera3D.
Signals died, stats_changed, message(text:String); get_interaction_prompt()->String.
take_damage(amount:float,source_position:Vector3=Vector3.ZERO); heal_to_full(); checkpoint_respawn(position:Vector3).
Input attacks use collision layer2 enemies; LOS ray includes layer1 walls; features are layer8.
Interact ray calls collider.interact(player). Shot/weapon hit calls collider.hit_weapon(weapon_id) when available.
Melee calls collider.take_damage(amount,stagger,source_position) on enemy nodes. Ranged obeys walls and consumes ammunition.
Player never calls old class selection, free mana or HeroClasses. Mouse/keyboard and controller input supported.

## World: AdventureWorld
extends Node3D. configure(state:Node)->void; load_floor(index:int)->void.
Signals floor_built(index:int), travel_requested(index:int), message(text:String).
get_spawn_position()->Vector3; cell_to_world(cell:Vector2i)->Vector3; world_to_cell(position:Vector3)->Vector2i.
get_floor_spec(index:int)->Dictionary includes name:String, element:String, color:Color, boss_spawn:Vector3, enemy_spawns:Array.
get_map_data()->Dictionary includes grid:Array[String], markers:Array[Dictionary], size:int.
is_walkable(cell:Vector2i)->bool; next_path_step(start:Vector2i,goal:Vector2i)->Vector2i.
Features interact(player)->void and hit_weapon(weapon_id:String)->void, plus prompt()->String.
Feature flags: key_collected,gate_open,shortcut_open,bridge_lowered,boss_defeated; persistent chest/secret ids.
Place meaningful biome obstacle before main key or boss; item-gated secret rewards sun_seal on Earth and moon_seal on Fire.
Lava damage and water/dive sequence must be real interactive mechanics, not decorative labels.

## Encounters: AdventureDirector
extends Node3D. configure(state:Node,world:Node,player:Node)->void; load_floor(index:int)->void.
Signals boss_status(name:String,hp:float,max_hp:float), message(text:String).
World floor_built triggers director.load_floor after player is moved. Stage enemy_spawns contain Vector3 or dictionaries with position.
At most eight active regular enemies, one stage boss and capped projectiles; distant mobs sleep.
Enemies Static/CharacterBody layer2 implement take_damage(amount:float,stagger:float=0.0,source_position:Vector3=Vector3.ZERO).
Ten-Hz path/LOS thinking, physics collision prevents passage through walls. Boss rewards use Adventure.defeat_boss.
For performance root tests need director.active_enemy_count()->int and projectile_count()->int.
