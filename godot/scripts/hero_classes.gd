class_name HeroClasses
extends RefCounted

enum WeaponType {
	MELEE_SWORD,
	MELEE_SPEAR,
	MELEE_DAGGER,
	RANGED_BOW,
	MAGIC_STAFF,
	SHIELD,
	MAGIC_WARD
}

static func get_class_data(hero_class: int) -> Dictionary:
	match hero_class:
		0:
			return {
				"name": "Warrior",
				"portrait": "res:/" + "/assets/sprites/warrior.png",
				"symbol": "WARRIOR",
				"max_hp": 150.0,
				"max_stamina": 100.0,
				"max_mana": 20.0,
				"speed": 4.8,
				"sprint_speed": 7.2,
				"dodge_speed": 10.0,
				"dodge_duration": 0.35,
				"dodge_iframes": 0.28,
				"stamina_regen": 30.0,
				"mana_regen": 2.0,
				"primary_weapon": {
					"name": "Iron Broadsword",
					"type": WeaponType.MELEE_SWORD,
					"damage_light": 35.0,
					"damage_heavy": 70.0,
					"stamina_cost_light": 18.0,
					"stamina_cost_heavy": 36.0,
					"mana_cost": 0.0,
					"range": 2.8,
					"heavy_stagger_duration": 0.85,
					"cooldown_light": 0.45,
					"cooldown_heavy": 0.95
				},
				"secondary_weapon": {
					"name": "Tower Shield",
					"type": WeaponType.SHIELD,
					"block_absorption": 0.85,
					"block_stamina_drain_multiplier": 1.0,
					"can_bash": true,
					"bash_damage": 20.0,
					"bash_stamina_cost": 25.0
				}
			}
		1:
			return {
				"name": "Elf",
				"portrait": "res:/" + "/assets/sprites/elf.png",
				"symbol": "ELF",
				"max_hp": 90.0,
				"max_stamina": 130.0,
				"max_mana": 50.0,
				"speed": 5.8,
				"sprint_speed": 8.8,
				"dodge_speed": 12.0,
				"dodge_duration": 0.40,
				"dodge_iframes": 0.36,
				"stamina_regen": 38.0,
				"mana_regen": 5.0,
				"primary_weapon": {
					"name": "Elven Longbow",
					"type": WeaponType.RANGED_BOW,
					"damage_light": 38.0,
					"damage_heavy": 75.0,
					"stamina_cost_light": 14.0,
					"stamina_cost_heavy": 28.0,
					"mana_cost": 0.0,
					"projectile_speed": 32.0,
					"range": 40.0,
					"heavy_stagger_duration": 0.70,
					"cooldown_light": 0.40,
					"cooldown_heavy": 0.85
				},
				"secondary_weapon": {
					"name": "Elven Dagger",
					"type": WeaponType.MELEE_DAGGER,
					"damage_light": 22.0,
					"damage_heavy": 45.0,
					"stamina_cost_light": 8.0,
					"stamina_cost_heavy": 16.0,
					"range": 1.9,
					"heavy_stagger_duration": 0.50,
					"block_absorption": 0.40,
					"cooldown_light": 0.25,
					"cooldown_heavy": 0.60
				}
			}
		2:
			return {
				"name": "Wizard",
				"portrait": "res:/" + "/assets/sprites/wizard.png",
				"symbol": "WIZARD",
				"max_hp": 80.0,
				"max_stamina": 80.0,
				"max_mana": 120.0,
				"speed": 4.5,
				"sprint_speed": 6.8,
				"dodge_speed": 9.5,
				"dodge_duration": 0.35,
				"dodge_iframes": 0.28,
				"stamina_regen": 25.0,
				"mana_regen": 12.0,
				"primary_weapon": {
					"name": "Archmage Fireball",
					"type": WeaponType.MAGIC_STAFF,
					"damage_light": 48.0,
					"damage_heavy": 95.0,
					"stamina_cost_light": 8.0,
					"stamina_cost_heavy": 16.0,
					"mana_cost_light": 15.0,
					"mana_cost_heavy": 35.0,
					"projectile_speed": 22.0,
					"blast_radius": 3.5,
					"range": 35.0,
					"heavy_stagger_duration": 0.90,
					"cooldown_light": 0.50,
					"cooldown_heavy": 1.10
				},
				"secondary_weapon": {
					"name": "Arcane Ward",
					"type": WeaponType.MAGIC_WARD,
					"block_absorption": 0.70,
					"block_stamina_drain_multiplier": 0.5,
					"mana_drain_per_hit": 15.0
				}
			}
		3:
			return {
				"name": "Valkyrie",
				"portrait": "res:/" + "/assets/sprites/valkyrie.png",
				"symbol": "VALKYRIE",
				"max_hp": 120.0,
				"max_stamina": 110.0,
				"max_mana": 40.0,
				"speed": 5.0,
				"sprint_speed": 7.6,
				"dodge_speed": 10.5,
				"dodge_duration": 0.36,
				"dodge_iframes": 0.30,
				"stamina_regen": 32.0,
				"mana_regen": 4.0,
				"primary_weapon": {
					"name": "War Spear",
					"type": WeaponType.MELEE_SPEAR,
					"damage_light": 34.0,
					"damage_heavy": 68.0,
					"stamina_cost_light": 16.0,
					"stamina_cost_heavy": 32.0,
					"mana_cost": 0.0,
					"range": 3.6,
					"heavy_stagger_duration": 0.80,
					"cooldown_light": 0.42,
					"cooldown_heavy": 0.90
				},
				"secondary_weapon": {
					"name": "Kite Shield",
					"type": WeaponType.SHIELD,
					"block_absorption": 0.75,
					"block_stamina_drain_multiplier": 0.9,
					"can_bash": true,
					"bash_damage": 18.0,
					"bash_stamina_cost": 20.0
				}
			}
		_:
			return get_class_data(0)

