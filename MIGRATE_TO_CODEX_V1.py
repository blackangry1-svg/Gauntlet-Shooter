from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import subprocess
import zipfile
WORK = Path('C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet_l').resolve(strict=True)
GAME = Path('C:/Users/pdard/OneDrive/Desktop/voxel games/gauntlet legends/Gauntlet Godot').resolve(strict=True)
BROWSER = GAME.parent / 'Gauntlet Shooter'
CACHE = Path('C:/Users/pdard/.codex/generated_images/01a1225d-d07b-7922-a3b2-ceaf200941cb')
REMOTE = 'https:' + '/' + '/github.com/blackangry1-svg/Gauntlet-Shooter.git'
BRANCH = 'codex/godot-takeover'
EXPECTED_HEAD = 'b19de8ea5552ee7378f24c01ad2070544bfcc0e8'
LOCAL = WORK / '.codex-local'
TARGET = WORK / 'godot'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def git(*args, cwd=WORK):
    result = subprocess.run(['git', '-C', str(cwd), *args], capture_output=True, check=True)
    return result.stdout.decode('utf-8').strip()

def read(path, boundary):
    if path.is_symlink():
        raise RuntimeError('Symlink rejected: ' + str(path))
    path.resolve(strict=True).relative_to(boundary)
    before = path.stat()
    data = path.read_bytes()
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise RuntimeError('Source changed: ' + str(path))
    return data
if (WORK / '.git').exists() or TARGET.exists() or LOCAL.exists():
    raise RuntimeError('Migration target is not fresh; inspect before retry')
if git('rev-parse', 'HEAD', cwd=BROWSER) != EXPECTED_HEAD:
    raise RuntimeError('Antigravity branch changed; inspect before migration')
deleted = git('ls-files', '--deleted', cwd=BROWSER).splitlines()
sources = []
for label, root in [('Godot_Baseline', GAME), ('Browser_With_Git_History', BROWSER), ('Thread_Generation_History', CACHE)]:
    for path in sorted(root.rglob('*')):
        if path.is_file() and '.godot' not in path.relative_to(root).parts:
            sources.append((label, root, path))
workspace_before = sorted((path for path in WORK.iterdir() if path.is_file()))
for path in workspace_before:
    sources.append(('Codex_Workspace_Before', WORK, path))
userdata = Path(os.environ['APPDATA']) / 'Godot/app_userdata/Gauntlet Souls-FPS'
if userdata.exists():
    for path in sorted(userdata.rglob('*')):
        if path.is_file():
            sources.append(('Player_Userdata', userdata, path))
LOCAL.mkdir()
backups = LOCAL / 'backups'
backups.mkdir()
archive_path = backups / 'Gauntlet_Before_Codex_2026-10-10.zip'
ledger = []
with zipfile.ZipFile(archive_path, 'x', allowZip64=True) as archive:
    for label, root, path in sources:
        data = read(path, root)
        relative = path.relative_to(root).as_posix()
        name = label + '/' + relative
        archive.writestr(name, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=1)
        ledger.append({'name': name, 'bytes': len(data), 'sha256': sha(data)})
    archive.writestr('SOURCE_LEDGER.json', json.dumps(ledger, indent=2).encode('utf-8'))
with zipfile.ZipFile(archive_path) as archive:
    if archive.testzip() is not None:
        raise RuntimeError('Backup CRC failed')
    for item in ledger:
        data = archive.read(item['name'])
        if len(data) != item['bytes'] or sha(data) != item['sha256']:
            raise RuntimeError('Backup readback failed: ' + item['name'])
git('init', '--initial-branch=main')
git('remote', 'add', 'origin', REMOTE)
git('fetch', '--no-tags', str(BROWSER), '+refs/heads/*:refs/remotes/antigravity/*')
git('fetch', '--no-tags', 'origin', 'main')
git('checkout', '-b', BRANCH, EXPECTED_HEAD)
for relative in deleted:
    path = (WORK / relative).resolve()
    path.relative_to(WORK)
    if path.is_file():
        path.unlink()
copied = []
for label, root in [('browser', BROWSER), ('godot', GAME)]:
    for path in sorted(root.rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if any((part in {'.git', '.godot', 'node_modules', '__pycache__'} for part in relative.parts)):
            continue
        destination = (WORK if label == 'browser' else TARGET) / relative
        destination.resolve().relative_to(WORK)
        destination.parent.mkdir(parents=True, exist_ok=True)
        data = read(path, root)
        destination.write_bytes(data)
        if sha(destination.read_bytes()) != sha(data):
            raise RuntimeError('Migration copy failed: ' + str(relative))
        copied.append({'group': label, 'path': destination.relative_to(WORK).as_posix(), 'bytes': len(data), 'sha256': sha(data)})
for label, root, path in sources:
    name = label + '/' + path.relative_to(root).as_posix()
    expected = next((item for item in ledger if item['name'] == name))
    if sha(read(path, root)) != expected['sha256']:
        raise RuntimeError('Original changed after migration: ' + name)
report = {'date': '2026-10-10', 'status': 'COPIED_AND_SOURCE_VERIFIED', 'canonical_project': 'godot/project.godot', 'repository': 'blackangry1-svg/Gauntlet-Shooter', 'branch': BRANCH, 'local_history_head': EXPECTED_HEAD, 'remote_main_at_capture': git('rev-parse', 'FETCH_HEAD'), 'backup': str(archive_path.relative_to(WORK)), 'backup_entries': len(ledger) + 1, 'backup_sha256': sha(archive_path.read_bytes()), 'files': copied, 'preserved_originals_verified': len(ledger), 'selected_artwork_verification': 'PENDING', 'runtime_checks': 'PENDING'}
(LOCAL / 'MIGRATION_SOURCE_LEDGER.json').write_text(json.dumps(ledger, indent=2), encoding='utf-8')
(WORK / 'MIGRATION_MANIFEST_V1.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key != 'files'}, indent=2))
