from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import zipfile

GAME = Path("C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot").resolve(strict=True)
TOOLS = Path("C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet_l").resolve(strict=True)
REFERENCES = GAME.parent
IMAGES = Path("C:/Users/pdard/.codex/generated_images/01a1225d-d07b-7922-a3b2-ceaf200941cb").resolve(strict=True)
DOWNLOADS = Path("C:/Users/pdard/Downloads").resolve(strict=True)
PREFIX = "Gauntlet_Complete_Thread_Package/"
ORIGINAL_HASHES = json.loads("{\"assets\\\\sprites\\\\champion_orc.png\":\"337f21f8531d57c2dd0bc60683a133beb3fd11a9d52569bcaf5ddf270ec0615a\",\"assets\\\\sprites\\\\dark_acolyte.png\":\"bc9692f37266746893ee3bbad430f9254cf8712952cf0f52d49b78dfed7bfcc3\",\"assets\\\\sprites\\\\death_bat.jpg\":\"12282d647e9b48a26d4eed17e2eb7b6bad48be7b6a61f662a7e32090401e1014\",\"assets\\\\sprites\\\\death_bat.png\":\"328934eaa8eea8f453809a65e946f3d53b44a97beaf2a74ce3db52e52827e84f\",\"assets\\\\sprites\\\\death_knight.jpg\":\"fe2197ae87853e218550b83a81d1b94c1aa9b4d64ae2a4ec24d0db19eea34db8\",\"assets\\\\sprites\\\\death_knight.png\":\"c90abfb418d6496b88cca8997175209e6dde78f4414576d26e2976f6ec4424af\",\"assets\\\\sprites\\\\elf.jpg\":\"8e1315b8e342672a053e1de55d66b232f754134c43332e926269021f06d20e7b\",\"assets\\\\sprites\\\\elf.png\":\"2bb72574e1db4979c878726bdaf5d3c09be6909a979ef01fd280c0cb274fab6c\",\"assets\\\\sprites\\\\lava_golem.png\":\"75032515fdd4278994974c31ebe2528b61c600d08b311f12e8e5bab3f09beff5\",\"assets\\\\sprites\\\\minotaur.png\":\"8d9d5108b9fc0a36f37a46aba7041d31d7bfa308a40eca231982d5dc33aebab3\",\"assets\\\\sprites\\\\orc_grunt.jpg\":\"e137058bb6fdb79f75ae0b371ffe59c5e1d5335e1d8d170119d435cea4945054\",\"assets\\\\sprites\\\\orc_grunt.png\":\"f84563b64b60c580030e6b7caa55a3d2c18ce3133bbf667eb1b020d240190cbb\",\"assets\\\\sprites\\\\pickups.jpg\":\"cc1857e083016bfa06a7b69013314e6e426f2c4d279a6b01fc635fe7363f93f2\",\"assets\\\\sprites\\\\pickups.png\":\"ac37f3b91ba11da45e0691a0bfc4b08418f5f4ca045b2ade8b4c900d38e32584\",\"assets\\\\sprites\\\\skeleton_archer.jpg\":\"6ac7e5a403bcf3528111d5d16abf0ff1c49edeb44af2c7c9e0e271db447a9be2\",\"assets\\\\sprites\\\\skeleton_archer.png\":\"74ce265eae9f77f842b9d1827970b31769631c9df5672463aae2a7a36f80dce5\",\"assets\\\\sprites\\\\stone_golem.jpg\":\"0d0fe78c0d6ce1c0a64def64b83551725d9a158e15dc23af96d9eb1c3e641544\",\"assets\\\\sprites\\\\stone_golem.png\":\"a2d986b68da299e88b5d76b6db3d34ddedbb997067b6d2ed57a163f4f70d8e11\",\"assets\\\\sprites\\\\storm_harpy.png\":\"d5d62bb2eb01881969e95d37f8ff2d92ed161f22a69f8d839c74f8bc45b8ae17\",\"assets\\\\sprites\\\\valkyrie.jpg\":\"7debbb8b28ac7d8563979d9579b201371fc74b64e5658ac20715a324010b5fa9\",\"assets\\\\sprites\\\\valkyrie.png\":\"01f71f5f5ce4d09ef9a15eca45da347aec76136a277c306378dd0c8ce41b3ccf\",\"assets\\\\sprites\\\\warrior.jpg\":\"5f08aa7282b9029f2fd53be13979b8719ead8d88a51100c149eea2c155e160b6\",\"assets\\\\sprites\\\\warrior.png\":\"95c8dfed824aad1e2be4182084df4e7cf8f6c238f8f0635aec6ae96c1771d0f6\",\"assets\\\\sprites\\\\wizard.jpg\":\"27d15bc068ed5115691865db84a07e078bb8178e68f23569df61ac09ad5588d5\",\"assets\\\\sprites\\\\wizard.png\":\"51bcd09db5c7b6f11b047f0e0bcd71103a36c4b18583a84bc866bbca2b74283d\",\"assets\\\\textures\\\\aqueduct_floor.jpg\":\"0b1fa549382cca4afb873bafd6f92afc08d2c10dee961625f5d8c17e450ec07b\",\"assets\\\\textures\\\\aqueduct_wall.jpg\":\"d523de3e47a780ccb16e151dbbff4573ef52f0f743efb694fdf1b34cffbb4a03\",\"assets\\\\textures\\\\floor.jpg\":\"42cb6b0b4d70149c8b3bd8d375a35614bb6c60bb677f809d4da99c8abe54923b\",\"assets\\\\textures\\\\forge_floor.jpg\":\"0078811f5c66dbe364ec91e7872ede05633d0a7a0656040be2ad1ead07f65c3c\",\"assets\\\\textures\\\\forge_wall.jpg\":\"6ef33c1d0f890625d2f068f11602068a0b38088d4b29210438a78a16079bb5d2\",\"assets\\\\textures\\\\gale_floor.jpg\":\"edb222d87f8491501f25f6b4fa90f3de1eac6eb017fe1ef5d53c33ebfaab6f02\",\"assets\\\\textures\\\\gale_wall.jpg\":\"7b0f0fa9333886f0c46f5e2fa174cfd447ea635de9178647685b8c2cd22b51ea\",\"assets\\\\textures\\\\throne_floor.jpg\":\"1dc199e04510146177d2934f32f2d36eb3828bf93973a4ffa0206f7557fc9f3e\",\"assets\\\\textures\\\\throne_wall.jpg\":\"b8f5dac79f6959a17f67099089a6b9f4f13d50d7d83d5f4333e8621d4b3331e0\",\"assets\\\\textures\\\\wall.jpg\":\"3e10aedbd8e972af724e00f6abbbf4db33305595e8ff0d74e56d86a606677414\",\"assets\\\\ui\\\\hud_frame.jpg\":\"cf54df83583480f51057b19e2a9e0ef48325445e2a3396572c96d7fa6565aa86\",\"assets\\\\ui\\\\key_icon.jpg\":\"fde985fa754c067f2373e71591fda4e95b1b60c6c2af5387ae4f98527c1f4b67\",\"assets\\\\ui\\\\level_up_crest.png\":\"f09464c669682216004dfa0d3aa9cb48621854b3a17ce73ba7c0e842fc601e89\",\"assets\\\\ui\\\\relic_crest.png\":\"b70f92d59de6e189070c9e8c339ccb3b88db9f49db3c35ebc7dd997a607875a2\",\"assets\\\\ui\\\\sword_fp.jpg\":\"4ed17682dc8688b8374d040d8dfadc7ef47632966f4454d771b802a87188a73e\",\"assets\\\\ui\\\\title_bg.jpg\":\"e32bc83d18d14026cea656a434e06e2c7525a50d5b8ffc16c515cbcc25aeac4e\"}")
OLD_SHIELD_SHA = "1912c74b79310e3c13343e97bac121d6c1927b0fb87369d5f556fe570d88d2fc"
EXCLUDED_DIRS = {".godot", ".git", "__pycache__"}
REQUIRED_DOCS = [
    "ASSET_BLUEPRINT_V1.md", "ASSET_DELIVERY_MANIFEST_V1.json",
    "ASSET_DELIVERY_VERIFICATION_V1.json", "ASSET_HANDOFF_V1.md",
    "EXPANSION_BLUEPRINT_V1.md", "EXPANSION_MANIFEST_V1.json",
    "EXPANSION_VERIFICATION_V1.json", "EXPANSION_HANDOFF_V1.md",
    "ELEMENTAL_STAGE_DESIGN_V1.md", "ELEMENTAL_LABYRINTHS_V1.json",
    "ELEMENTAL_LABYRINTHS_V1.html"
]

def digest(data):
    return hashlib.sha256(data).hexdigest()

def stable_read(path, boundary):
    if path.is_symlink():
        raise RuntimeError("Symlink rejected: " + str(path))
    resolved = path.resolve(strict=True)
    resolved.relative_to(boundary)
    before = resolved.stat()
    data = resolved.read_bytes()
    after = resolved.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise RuntimeError("File changed during packaging: " + str(path))
    return data

def tree_files(root):
    return sorted(
        (path for path in root.rglob("*")
         if path.is_file() and not any(part in EXCLUDED_DIRS for part in path.relative_to(root).parts)),
        key=lambda path: path.relative_to(root).as_posix().lower()
    )

for name in REQUIRED_DOCS:
    if not (GAME / name).is_file():
        raise RuntimeError("Missing delivered document: " + name)

manifests = [
    json.loads(stable_read(GAME / "ASSET_DELIVERY_MANIFEST_V1.json", GAME)),
    json.loads(stable_read(GAME / "EXPANSION_MANIFEST_V1.json", GAME))
]
if [len(item["assets"]) for item in manifests] != [13, 22]:
    raise RuntimeError("Unexpected selected artwork counts")

selected = []
for manifest in manifests:
    for asset in manifest["assets"]:
        source = Path(asset["source_path"]).resolve(strict=True)
        relative = source.relative_to(GAME).as_posix()
        expected = asset["sha256"].lower()
        if digest(stable_read(source, GAME)) != expected:
            raise RuntimeError("Selected source hash mismatch: " + relative)
        generated = Path(asset["generated_source_path"]).resolve(strict=True)
        generated.relative_to(IMAGES)
        if digest(stable_read(generated, IMAGES)) != expected:
            raise RuntimeError("Selected generation hash mismatch: " + asset["asset"])
        selected.append({
            "asset": asset["asset"], "category": asset["category"],
            "package_path": PREFIX + "Gauntlet Godot/" + relative,
            "generated_archive_path": PREFIX + "Generated_Art_Archive/" + generated.relative_to(IMAGES).as_posix(),
            "sha256": expected
        })

for relative, expected in ORIGINAL_HASHES.items():
    original_path = GAME / relative
    if digest(stable_read(original_path, GAME)) != expected:
        raise RuntimeError("Original asset preservation mismatch: " + relative)
if digest(stable_read(GAME / "assets/weapons/shield_source_v1.png", GAME)) != OLD_SHIELD_SHA:
    raise RuntimeError("Superseded shield preservation mismatch")

inputs = []
for label, root in [("Gauntlet Godot", GAME), ("Thread_Tools_and_Brief", TOOLS)]:
    for path in tree_files(root):
        inputs.append((PREFIX + label + "/" + path.relative_to(root).as_posix(), path, root))
reference_files = sorted((path for path in REFERENCES.iterdir() if path.is_file()), key=lambda path: path.name.lower())
for path in reference_files:
    inputs.append((PREFIX + "Project_References/" + path.name, path, REFERENCES))
image_files = tree_files(IMAGES)
if len(image_files) != 50 or any(path.suffix.lower() != ".png" for path in image_files):
    raise RuntimeError("Unexpected thread generation archive inventory")
for path in image_files:
    inputs.append((PREFIX + "Generated_Art_Archive/" + path.relative_to(IMAGES).as_posix(), path, IMAGES))

names = [entry[0] for entry in inputs]
if len(names) != len(set(names)):
    raise RuntimeError("Duplicate package paths")
created = datetime.now(timezone.utc)
filename = "Gauntlet_Complete_Thread_Package_" + created.strftime("%Y-%m-%d_%H%M%S_UTC") + ".zip"
archive_path = DOWNLOADS / filename
archive_path.resolve().relative_to(DOWNLOADS)
readme = """Gauntlet complete thread package

Start here
- Extract the entire archive to a folder.
- Open Gauntlet Godot/ELEMENTAL_LABYRINTHS_V1.html in a browser for the five interactive maze designs. Its artwork links are relative and work from the extracted folder.
- Read Gauntlet Godot/ASSET_HANDOFF_V1.md and EXPANSION_HANDOFF_V1.md for the Antigravity integration instructions.
- Import Gauntlet Godot/project.godot into Godot to open the existing project snapshot.

Included
- Complete current Godot project source and assets, plus all 11 delivered design, manifest, handoff, and verification files.
- 35 selected artwork sources: five weapons, eight original character sheets, 12 new enemy sheets, five new boss sheets, and five elemental biome concepts.
- Corrected shield_source_v2.png and the preserved shield_source_v1.png.
- All 50 image generation outputs from this thread, including 14 additional intermediate variants. SOURCE_VARIANTS_INDEX.json maps copies to delivered names.
- Original master guide, source blueprints, delivery tools, this archive packager, and the project's top-level reference files.
- PACKAGE_INVENTORY.json records the exact archived source paths, byte sizes, and SHA256 hashes.

Artwork status
The character and weapon PNGs are reviewed source artwork. Transparency cleanup, safe frame extraction, canonical sizing, and Godot integration remain as documented in the handoffs. The biome images are concept art. The five labyrinths are validated design proposals and an interactive planner. This package preserves the current game snapshot; packaging does not implement the expansion.

Portability
Historical manifests and handoffs retain their original absolute Windows paths as delivery evidence. The portable project lives in Gauntlet Godot. Use its relative assets paths after extraction. Delivery scripts and the archive packager preserve the original local workflow and contain original machine paths.

Archive verification
The packager checks all 35 selected source hashes against the delivery manifests, preserves the 41 pre-existing assets and old shield hash, reads every ZIP entry back, and checks CRC integrity and SHA256 hashes. The inventory describes all content except its own self-referential hash.

Scope
This archive contains the thread's complete deliverables and generation history, the existing Godot project snapshot, and reference files. Historical sibling browser-game backup folders and reproducible engine caches are outside this delivery.
"""
records = []
variants = []
preserved_shield = PREFIX + "Gauntlet Godot/assets/weapons/shield_source_v1.png"
selected_by_hash = {}
for asset in selected:
    selected_by_hash.setdefault(asset["sha256"], []).append(asset["package_path"])

def add_bytes(archive, name, data, group, source=None):
    compression = zipfile.ZIP_STORED if Path(name).suffix.lower() in {".png", ".jpg", ".jpeg", ".pdf"} else zipfile.ZIP_DEFLATED
    archive.writestr(name, data, compress_type=compression, compresslevel=6)
    record = {"path": name, "bytes": len(data), "sha256": digest(data), "group": group}
    if source is not None:
        record["original_source_path"] = str(source)
    records.append(record)
    return record

with zipfile.ZipFile(archive_path, mode="x", allowZip64=True) as archive:
    for name, path, boundary in inputs:
        data = stable_read(path, boundary)
        group = name[len(PREFIX):].split("/")[0]
        record = add_bytes(archive, name, data, group, path)
        if boundary == IMAGES:
            matches = selected_by_hash.get(record["sha256"], [])
            if record["sha256"] == OLD_SHIELD_SHA:
                matches = matches + [preserved_shield]
            variants.append({
                "path": name, "sha256": record["sha256"],
                "delivered_copies": matches,
                "status": "delivered_copy" if matches else "intermediate_generation"
            })
    add_bytes(archive, PREFIX + "PACKAGE_README.md", readme.encode("utf-8"), "Package_Documentation")
    add_bytes(archive, PREFIX + "SOURCE_VARIANTS_INDEX.json",
              json.dumps(variants, indent=2).encode("utf-8"), "Package_Documentation")
    inventory = {
        "schema_version": 1, "created_utc": created.isoformat(),
        "scope": "Complete artwork and maze thread delivery plus existing Godot source snapshot",
        "selected_artwork_count": len(selected), "generated_png_count": len(variants),
        "intermediate_generation_count": sum(item["status"] == "intermediate_generation" for item in variants),
        "original_asset_hashes_preserved": len(ORIGINAL_HASHES),
        "selected_artwork": selected, "files": records,
        "inventory_self_hash": "Excluded to avoid self-reference"
    }
    inventory_name = PREFIX + "PACKAGE_INVENTORY.json"
    inventory_bytes = json.dumps(inventory, indent=2).encode("utf-8")
    archive.writestr(inventory_name, inventory_bytes, compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)

with zipfile.ZipFile(archive_path, "r") as archive:
    if archive.testzip() is not None:
        raise RuntimeError("ZIP CRC verification failed")
    if len(archive.namelist()) != len(records) + 1 or len(set(archive.namelist())) != len(archive.namelist()):
        raise RuntimeError("ZIP entry inventory mismatch")
    for record in records:
        archived = archive.read(record["path"])
        if len(archived) != record["bytes"] or digest(archived) != record["sha256"]:
            raise RuntimeError("ZIP SHA256 mismatch: " + record["path"])
    if archive.read(inventory_name) != inventory_bytes:
        raise RuntimeError("Inventory readback mismatch")
    for name, path, boundary in inputs:
        record = next(item for item in records if item["path"] == name)
        if digest(stable_read(path, boundary)) != record["sha256"]:
            raise RuntimeError("Source changed after ZIP creation: " + str(path))

archive_hash = hashlib.sha256()
with archive_path.open("rb") as stream:
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        archive_hash.update(chunk)
print(json.dumps({
    "verdict": "VERIFIED_COMPLETE_PACKAGE", "zip_path": str(archive_path),
    "zip_bytes": archive_path.stat().st_size, "zip_sha256": archive_hash.hexdigest(),
    "entries": len(records) + 1, "selected_artwork": len(selected),
    "generated_pngs": len(variants), "additional_intermediate_variants": inventory["intermediate_generation_count"],
    "project_files": sum(item["group"] == "Gauntlet Godot" for item in records),
    "reference_files": len(reference_files), "original_assets_preserved": len(ORIGINAL_HASHES),
    "crc_and_all_entry_sha256_verified": True
}, indent=2))

