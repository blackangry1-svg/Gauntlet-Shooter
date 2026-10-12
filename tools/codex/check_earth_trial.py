"""First-floor width trial checks with explicitly isolated save files."""
from pathlib import Path
import argparse, json, re, subprocess, time
ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--godot", required=True)
args = parser.parse_args()
engine = str(Path(args.godot).resolve())
output = ROOT / ".codex-local" / "earth_width_trial" / "integrated"
output.mkdir(parents=True, exist_ok=True)
scripts = ["test_suite", "test_adventure_state", "test_adventure_world", "test_adventure_combat", "test_adventure_campaign", "test_adventure_progression", "test_earth_width"]
records = []
for name in scripts:
    start = time.monotonic()
    script = ROOT / "godot" / "tests" / (name + ".gd")
    if not script.is_file():
        records.append({"check": name, "passed": False, "reason": "missing script"})
        continue
    command = [engine, "--headless", "--path", str(ROOT / "godot"), "--script", str(script), "--log-file", str(output / (name + "_engine.log")), "--", "--adventure-save=" + str(output / (name + "_autoload.json")), "--test-save=" + str(output / (name + "_fixture.json"))]
    print("RUNNING " + name, flush=True)
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=120)
        text = result.stdout + result.stderr
        (output / (name + ".log")).write_text(text, encoding="utf-8")
        errors = re.findall(r"(?m)^(?:SCRIPT ERROR|ERROR):.*$", text)
        failures = re.findall(r"(?m)^FAIL(?:ED)?\b.*$", text)
        summaries = re.findall(r"(?m)^.*(?:RESULTS|checks|SUMMARY|PASSED|TESTS|assertions).*$", text)
        record = {"check": name, "passed": result.returncode == 0 and not errors and not failures, "exit_code": result.returncode, "seconds": round(time.monotonic()-start,3), "errors": errors, "failures": failures, "summaries": summaries[-3:]}
    except subprocess.TimeoutExpired:
        record = {"check": name, "passed": False, "reason": "timeout"}
    records.append(record)
    print(json.dumps(record), flush=True)
report = {"engine": engine, "checks": records, "passed": all(x["passed"] for x in records), "isolated": True, "scope": "headless contracts and physics; rendered performance and physical input are separate evidence"}
(output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print("REPORT " + str(output / "report.json"))
raise SystemExit(0 if report["passed"] else 1)
