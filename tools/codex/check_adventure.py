"""Isolated acceptance checks for the elemental single-hero adventure."""
from pathlib import Path
import argparse
import json
import os
import re
import shutil
import subprocess
import time
ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / 'godot'
OUTPUT = ROOT / '.codex-local' / 'overhaul'
parser = argparse.ArgumentParser()
parser.add_argument('--godot', default=os.environ.get('GODOT_BIN'))
parser.add_argument('--render', action='store_true')
args = parser.parse_args()
candidates = [args.godot, shutil.which('godot'), shutil.which('godot4')]
candidates.extend((str(p) for p in Path(os.environ.get('LOCALAPPDATA', '')).glob('Programs/Godot/*/*console.exe')))
binary = next((p for p in candidates if p and Path(p).is_file()), None)
if not binary:
    raise SystemExit('Pass --godot with the Godot4.7 executable.')
OUTPUT.mkdir(parents=True, exist_ok=True)
version = subprocess.check_output([binary, '--version'], text=True).strip()
checks = []

def run(name, parameters, timeout=180):
    log = OUTPUT / (name + '.log')
    save = OUTPUT / (name + '_save.json')
    command = [binary, '--path', str(PROJECT), '--log-file', str(log)] + parameters
    command += ['--', '--adventure-save=' + str(save)]
    if name == 'render':
        command += ['--capture-dir=' + str(OUTPUT / 'render')]
    start = time.monotonic()
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
        output = result.stdout + result.stderr
        code = result.returncode
    except subprocess.TimeoutExpired as error:
        output = str(error)
        code = -1
    log.write_text(output, encoding='utf-8')
    errors = re.findall('(?m)^(?:SCRIPT ERROR|ERROR:|FAIL ).*$', output)
    assertions = re.findall('(?m)^PASS.*$', output)
    count_summary = re.search('(?:checks=|TEST RESULTS: )([0-9]+)', output)
    assertion_count = int(count_summary.group(1)) if count_summary else len(assertions)
    record = {'name': name, 'exit_code': code, 'elapsed_seconds': round(time.monotonic() - start, 2), 'passed': code == 0 and (not errors), 'assertions': assertion_count, 'errors': errors, 'log': str(log.relative_to(ROOT))}
    checks.append(record)
    print(json.dumps(record), flush=True)
    if name == 'combat':
        run('campaign', ['--headless', '--script', 'tests/test_adventure_campaign.gd'])
run('import', ['--headless', '--editor', '--import', '--quit'])
run('legacy', ['--headless', '--script', 'tests/test_suite.gd'])
run('state_player', ['--headless', '--script', 'tests/test_adventure_state.gd'])
run('world', ['--headless', '--script', 'tests/test_adventure_world.gd'])
run('combat', ['--headless', '--script', 'tests/test_adventure_combat.gd'])
run('boot', ['--headless', '--quit-after', '180'])
if args.render:
    run('render', ['--script', 'tests/render_adventure.gd'], 240)
report = {'schema': 1, 'godot_version': version, 'checks': checks, 'passed': all((check['passed'] for check in checks)), 'note': 'Render flag runs real OpenGL capture and local bounded combat frame timings. User physical input and full campaign balance remain separate.'}
(OUTPUT / 'acceptance.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
raise SystemExit(0 if report['passed'] else 1)
