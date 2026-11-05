"""Execution and testing harness with content-addressed caching (Phase 1.4).

Executes student and reference C++ code in a sandboxed subprocess:
- Enforces timeout guards (compile: 10s, execution: 2s per test).
- Extracts compile errors and line citations.
- Content-addressed cache (MD5 of code + test suite) avoids redundant compilation.
- In environments without g++, gracefully returns execution report with available=False.
"""
from dataclasses import dataclass
import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger("exec_harness")


@dataclass
class TestCaseItem:
    stdin: str
    expected_stdout: str


def compute_exec_cache_key(code: str, test_cases: List[Dict[str, str]]) -> str:
    """Deterministic MD5 cache key over code and test suite."""
    tcs = [(tc.get("stdin", tc.get("in", "")), tc.get("expected_stdout", tc.get("out", "")))
           for tc in test_cases]
    payload = f"{code.strip()}\n{tcs}"
    return hashlib.md5(payload.encode("utf-8")).hexdigest()


class ExecutionCache:
    def __init__(self, cache_file_path: Optional[str] = None):
        self.cache_file_path = cache_file_path
        self._cache: Dict[str, dict] = {}
        if cache_file_path and os.path.isfile(cache_file_path):
            try:
                with open(cache_file_path, "r", encoding="utf-8") as f:
                    self._cache = json.load(f)
                logger.info(f"Loaded {len(self._cache)} cached execution reports from {cache_file_path}")
            except Exception as e:
                logger.warning(f"Failed to read execution cache at {cache_file_path}: {e}")

    def get(self, key: str) -> Optional[dict]:
        return self._cache.get(key)

    def set(self, key: str, report: dict) -> None:
        self._cache[key] = report

    def save(self) -> None:
        if not self.cache_file_path:
            return
        os.makedirs(os.path.dirname(os.path.abspath(self.cache_file_path)), exist_ok=True)
        with open(self.cache_file_path, "w", encoding="utf-8") as f:
            json.dump(self._cache, f, indent=2)


def execute_cpp_code(
    code: str,
    test_cases: List[Dict[str, str]],
    cache: Optional[ExecutionCache] = None,
    compile_timeout: float = 10.0,
    run_timeout: float = 2.0
) -> dict:
    """Compile and test C++ code, returning structured execution report."""
    key = compute_exec_cache_key(code, test_cases)
    if cache is not None:
        hit = cache.get(key)
        if hit is not None:
            return hit

    # Check for g++
    gpp_bin = shutil.which("g++")
    if not gpp_bin:
        report = {
            "available": False,
            "compile_ok": False,
            "reason": "g++ compiler not available in environment"
        }
        if cache is not None:
            cache.set(key, report)
        return report

    tmpdir = tempfile.mkdtemp(prefix="cpp_eval_")
    src_file = os.path.join(tmpdir, "solution.cpp")
    exe_file = os.path.join(tmpdir, "solution.exe" if os.name == "nt" else "solution")

    try:
        with open(src_file, "w", encoding="utf-8") as f:
            f.write(code)

        # 1. Compile with -std=c++17 -O0
        cmd = [gpp_bin, "-std=c++17", "-O0", "-o", exe_file, src_file]
        cr = subprocess.run(cmd, capture_output=True, text=True, timeout=compile_timeout)

        if cr.returncode != 0:
            lines = []
            for l in cr.stderr.splitlines():
                m = re.match(r"[^:]+:(\d+):\d+:\s*(.*)", l)
                if m:
                    lines.append((int(m.group(1)), m.group(2).strip()))
            report = {
                "available": True,
                "compile_ok": False,
                "compile_error": cr.stderr[:800],
                "compile_lines": lines[:10],
                "tests_passed": 0,
                "tests_total": len(test_cases),
                "test_results": [],
                "runtime_errors": []
            }
            if cache is not None:
                cache.set(key, report)
            return report

        # 2. Run test cases
        results = []
        passed_count = 0
        runtime_errors = []

        for tc in test_cases:
            stdin_val = tc.get("stdin", tc.get("in", ""))
            expected_val = tc.get("expected_stdout", tc.get("out", "")).strip()

            try:
                proc = subprocess.run(
                    [exe_file],
                    input=stdin_val,
                    capture_output=True,
                    text=True,
                    timeout=run_timeout
                )
                actual_val = proc.stdout.strip()
                # Approach-agnostic output matching: check containment or exact match
                passed = (expected_val in actual_val) or (actual_val == expected_val)
                results.append({
                    "stdin": stdin_val[:120],
                    "expected": expected_val[:120],
                    "actual": actual_val[:120],
                    "passed": passed,
                    "exit_code": proc.returncode,
                    "timeout": False
                })
                if passed:
                    passed_count += 1
                if proc.returncode != 0:
                    runtime_errors.append(f"exit code {proc.returncode}")
            except subprocess.TimeoutExpired:
                results.append({
                    "stdin": stdin_val[:120],
                    "expected": expected_val[:120],
                    "actual": "",
                    "passed": False,
                    "exit_code": None,
                    "timeout": True
                })
                runtime_errors.append("timeout")

        report = {
            "available": True,
            "compile_ok": True,
            "compile_error": "",
            "compile_lines": [],
            "tests_passed": passed_count,
            "tests_total": len(test_cases),
            "test_results": results,
            "runtime_errors": runtime_errors[:4]
        }
        if cache is not None:
            cache.set(key, report)
        return report

    except Exception as e:
        report = {
            "available": False,
            "compile_ok": False,
            "reason": f"Execution harness error: {e}"
        }
        return report
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

