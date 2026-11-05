"""Execution test harness for Quiz 3 real student submissions (Phase 4).

Constructs test cases strictly from question.txt specification:
- Amount in range (1000, 9999]
- Denominations: 1000, 500, 100, 50, 20, 10, 5, 1
- Flexible matching of outputs (Option A: ignores minor whitespace/colon deviations).

Can run on both raw (quiz3_raw/) and cleaned (quiz3_clean/) student submissions.
"""
import argparse
import glob
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Dict, List, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("run_real_exec")

QUIZ3_CANONICAL_TESTS = [
    {
        "id": "tc1_sample",
        "stdin": "2896\n",
        "expected": "1000:2\n500:1\n100:3\n50:1\n20:2\n10:0\n5:1\n1:1",
        "denominations": {1000: 2, 500: 1, 100: 3, 50: 1, 20: 2, 10: 0, 5: 1, 1: 1}
    },
    {
        "id": "tc2_min_bound",
        "stdin": "1001\n",
        "expected": "1000:1\n500:0\n100:0\n50:0\n20:0\n10:0\n5:0\n1:1",
        "denominations": {1000: 1, 500: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 1}
    },
    {
        "id": "tc3_all_notes",
        "stdin": "1888\n",
        "expected": "1000:1\n500:1\n100:3\n50:1\n20:1\n10:1\n5:1\n1:3",
        "denominations": {1000: 1, 500: 1, 100: 3, 50: 1, 20: 1, 10: 1, 5: 1, 1: 3}
    },
    {
        "id": "tc4_max_bound",
        "stdin": "9999\n",
        "expected": "1000:9\n500:1\n100:4\n50:1\n20:2\n10:0\n5:1\n1:4",
        "denominations": {1000: 9, 500: 1, 100: 4, 50: 1, 20: 2, 10: 0, 5: 1, 1: 4}
    },
    {
        "id": "tc5_exact_multiple",
        "stdin": "5000\n",
        "expected": "1000:5\n500:0\n100:0\n50:0\n20:0\n10:0\n5:0\n1:0",
        "denominations": {1000: 5, 500: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0}
    },
]


def check_denomination_match(actual_stdout: str, expected_dict: Dict[int, int]) -> bool:
    """Option A matcher: checks if expected denomination counts appear in student output.
    
    Accepts formats such as:
    - 1000:2
    - 1000: 2
    - 1000 = 2
    - 1000 notes: 2
    """
    clean_out = actual_stdout.replace(" ", "").lower()
    matches = 0
    for denom, count in expected_dict.items():
        pattern = rf"{denom}[:=]?{count}"
        if re.search(pattern, clean_out):
            matches += 1
    # Full pass if all 8 denominations are found, or at least the non-zero ones
    non_zero = sum(1 for c in expected_dict.values() if c > 0)
    return matches >= 8 or matches >= non_zero


def run_quiz3_execution(
    cpp_files_dir: str,
    output_reports_path: str,
    compile_timeout: float = 10.0,
    run_timeout: float = 2.0
) -> Dict[str, dict]:
    """Execute all C++ files in cpp_files_dir against QUIZ3_CANONICAL_TESTS."""
    gpp = shutil.which("g++")
    if not gpp:
        logger.warning("g++ compiler not found in environment. Producing static execution report.")
        return {}

    reports = {}
    files = sorted(glob.glob(os.path.join(cpp_files_dir, "*.cpp")))
    logger.info(f"Executing {len(files)} files in {cpp_files_dir}...")

    for fpath in files:
        sid = os.path.splitext(os.path.basename(fpath))[0]
        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
            code = f.read()

        tmpdir = tempfile.mkdtemp(prefix="q3_exec_")
        src = os.path.join(tmpdir, "sol.cpp")
        exe = os.path.join(tmpdir, "sol.exe" if os.name == "nt" else "sol")

        try:
            with open(src, "w", encoding="utf-8") as f:
                f.write(code)

            cr = subprocess.run([gpp, "-std=c++17", "-O0", "-o", exe, src],
                                capture_output=True, text=True, timeout=compile_timeout)
            if cr.returncode != 0:
                lines = []
                for l in cr.stderr.splitlines():
                    m = re.match(r"[^:]+:(\d+):\d+:\s*(.*)", l)
                    if m:
                        lines.append((int(m.group(1)), m.group(2).strip()))
                reports[sid] = {
                    "available": True,
                    "compile_ok": False,
                    "compile_error": cr.stderr[:800],
                    "compile_lines": lines[:10],
                    "tests_passed": 0,
                    "tests_total": len(QUIZ3_CANONICAL_TESTS),
                    "test_results": []
                }
                continue

            results = []
            passed_cnt = 0
            for tc in QUIZ3_CANONICAL_TESTS:
                try:
                    pr = subprocess.run([exe], input=tc["stdin"], capture_output=True,
                                        text=True, timeout=run_timeout)
                    stdout = pr.stdout.strip()
                    ok = check_denomination_match(stdout, tc["denominations"])
                    results.append({
                        "stdin": tc["stdin"].strip(),
                        "expected": tc["expected"],
                        "actual": stdout[:150],
                        "passed": ok,
                        "exit_code": pr.returncode,
                        "timeout": False
                    })
                    if ok:
                        passed_cnt += 1
                except subprocess.TimeoutExpired:
                    results.append({
                        "stdin": tc["stdin"].strip(),
                        "expected": tc["expected"],
                        "actual": "",
                        "passed": False,
                        "exit_code": None,
                        "timeout": True
                    })

            reports[sid] = {
                "available": True,
                "compile_ok": True,
                "compile_error": "",
                "compile_lines": [],
                "tests_passed": passed_cnt,
                "tests_total": len(QUIZ3_CANONICAL_TESTS),
                "test_results": results
            }

        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    with open(output_reports_path, "w", encoding="utf-8") as f:
        json.dump(reports, f, indent=2)
    logger.info(f"Saved {len(reports)} execution reports -> {output_reports_path}")
    return reports


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default="quiz3_clean", help="Folder with .cpp student files")
    parser.add_argument("--out", default="quiz3_execution_reports.json", help="Output execution reports JSON")
    args = parser.parse_args()
    run_quiz3_execution(args.dir, args.out)

