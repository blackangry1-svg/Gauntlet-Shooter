# Codex project handoff
Date: 2026-10-12. Owner: Codex. Earth corridor trial implemented and verified.

## Canonical project and review
Work in this gauntlet_l checkout; the native game is godot/project.godot.
Repository: blackangry1-svg/Gauntlet-Shooter.
Active branch: codex/earth-width-trial; base: codex/elemental-overhaul at8a48bc5.
Earth trial draft: https://github.com/blackangry1-svg/Gauntlet-Shooter/pull/3; implementation commit4830ab6.
Prior overhaul draft is PR2; migration draft is PR1. Keep their history and review branches.
The original sibling Godot project and root browser implementation remain baselines.

## Play and current contracts
Double-click PlayEarthTrial.cmd to begin a separate shore trial save.
PlayAdventure.cmd continues the regular adventure save; PlayAdventure.ps1 -Editor opens Godot.
GODOT_BIN can select the engine; verified local engine is4.7.2.
Read EARTH_WIDTH_PLAYTEST.md for controls, route, refuge, save/reload and performance checks.
Read EARTH_WIDTH_TRIAL_BLUEPRINT_V1.md before changes; retain OVERHAUL_BLUEPRINT_V1.md and ADVENTURE_INTERFACES_V1.md campaign contracts.
Use EARTH_WIDTH_ACCEPTANCE_V1.json for current evidence and source fingerprints.
OVERHAUL_ACCEPTANCE_V1.json describes the preserved prior release.

## Current first-floor trial
Earth retains its31x31 authored maze, markers, keys, secrets, return shortcut and boss exit.
Its cell width is9m (previously3m), walls5.4m; both gates and physics span the expanded passages.
Player/enemy size, reach and saved checkpoint cells retain human scale.
A cached procedural sky,24 distant batched silhouettes and open skyline accompany the shore.
Eight mixed squads of3 regular foes plus a hidden guardian populate Earth; boss is additional.
Reachable paths, wall/door collision, lane offsets and bounded pair separation drive groups.
Stronger enemies keep hunting until sanctuary or unreachable topology; much weaker foes retreat cautiously.
Earth entry/checkpoints and refuge lifts suppress hostile damage and clear incoming shots/tells.
Water, Fire, Air and Aether retain their earlier geometry and encounter populations.
Large boss chambers, lakes and parkour require the user's successful width test first.

## Progression, saves and CPU
One hero uses XP for refuge levels/Strength/Dexterity/Focus; Embers still buy smith upgrades.
Weapon stat requirements appear in the journal; driftwood is always usable.
Schema2 accepts schema1 with permanent attunement for previously owned weapons; load never rewrites the save.
Current resources stay unchanged during stat/equipment sync; fresh loaded heroes start at full scaled capacities.
Combined kill XP/currency/ammo persists once. Duplicate defeats do not grant or save again.
Earth awake caps: low8, balanced10, native12 regular foes; other floors8; one boss additional.
Combined projectile cap24, hostile12;10Hz AI shares a cached field; one floor, batched geometry, no shadows.
Default75%/60FPS; low60%/45FPS. Intel UHD scripted10-actor/12-shot sample17.2ms median/19.4ms p95; low8-actor/12-shot sample22.2/23.8ms.
Timing is a sample, not a locked frame rate; physical feel and long-session balance await the user.

## Verification and preservation
Run python tools/codex/check_earth_trial.py --godot <executable> for707 isolated headless assertions.
Independent Earth physics includes268 capsule route sweeps and full-width closed/open gate tracks.
Real OpenGL captures cover all5 floors, skyline, grouped corridor, boss, map, settings, merchant and refuge UI; logs/PNGs stay in.codex-local/earth_width_trial.
The legacy regression script emitted one2-ObjectDB-instance exit warning; current adventure suites and rendered runs had no warnings/errors.
All130 original browser and105 sibling Godot fingerprint entries match; authored maze JSON and both external adventure saves match their pre-trial hashes.
Pre-trial source/save backup is recorded in EARTH_WIDTH_ACCEPTANCE_V1.json. Art sources and both shields remain preserved.
GEN9 tiles remain inaccessible; bounded symbol/semantic inspection supplemented generic sidecars. Ratification is not runtime proof.
Next: human Earth width/combat/refuge/save test, then blueprint larger chambers and platforming from that feedback.
