from pathlib import Path
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / "godot"
parser = argparse.ArgumentParser(description="Import, test and boot the native Gauntlet project.")
parser.add_argument("--godot", default=os.environ.get("GODOT_BIN"))
args = parser.parse_args()
candidate = args.godot or shutil.which("godot") or shutil.which("godot4")
if not candidate and os.environ.get("LOCALAPPDATA"):
    candidate = str(Path(os.environ["LOCALAPPDATA"]) / "Programs/Godot/4.7.2/Godot_v4.7.2-stable_win64_console.exe")
if not candidate or not Path(candidate).is_file():
    parser.error("Supply --godot <executable> or set GODOT_BIN.")
engine = str(Path(candidate).resolve())
output_dir = ROOT / ".codex-local/validation"
output_dir.mkdir(parents=True, exist_ok=True)
version = subprocess.run([engine, "--version"], text=True, capture_output=True, check=True).stdout.strip()
checks = []
steps = [
    ("import", ["--headless", "--path", str(PROJECT), "--editor", "--import"], 180),
    ("tests", ["--headless", "--path", str(PROJECT), "--script", "tests/test_suite.gd"], 120),
    ("scene_boot", ["--headless", "--path", str(PROJECT), "--quit-after", "120"], 60)
]
for name, command, timeout in steps:
    print("RUNNING " + name, flush=True)
    start = time.monotonic()
    log_path = output_dir / (name + ".log")
    try:
        result = subprocess.run([engine, *command, "--log-file", str(output_dir / (name + "_engine.log"))],
                                text=True, capture_output=True, timeout=timeout)
        output = result.stdout + result.stderr
        engine_errors = re.findall(r"(?m)^(?:SCRIPT ERROR|ERROR):.*$", output)
        summary = re.search(r"TEST RESULTS: (\d+)/(\d+) PASSED \| (\d+) FAILED", output)
        passed = result.returncode == 0 and not engine_errors
        if name == "tests":
            passed = passed and summary is not None and summary.group(3) == "0" and summary.group(1) == summary.group(2)
        record = {"check": name, "passed": bool(passed), "exit_code": result.returncode,
                  "seconds": round(time.monotonic() - start, 3), "engine_errors": engine_errors,
                  "warnings": re.findall(r"(?m)^WARNING:.*$", output)}
        if summary:
            record["assertions_passed"] = int(summary.group(1))
            record["assertions_total"] = int(summary.group(2))
            record["assertions_failed"] = int(summary.group(3))
    except subprocess.TimeoutExpired as error:
        output = str(error)
        record = {"check": name, "passed": False, "reason": "timeout", "seconds": timeout}
    log_path.write_text(output, encoding="utf-8")
    checks.append(record)
    print(json.dumps(record), flush=True)
    if not record["passed"]:
        print(output[-6000:], flush=True)
        break
report = {"godot_version": version, "project": "godot/project.godot", "checks": checks,
          "passed": len(checks) == 3 and all(item["passed"] for item in checks),
          "scope": "Headless import, existing gameplay assertions and bounded scene boot"}
(output_dir / "RESULTS.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2), flush=True)
sys.exit(0 if report["passed"] else 1)
