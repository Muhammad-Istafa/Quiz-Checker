const fs = require('fs');
const { pyToIpynb } = require('./py_to_ipynb.js');

// 1. Clean fast preflight for nb1_data and n0_audit
const FAST_PREFLIGHT = `# %%
import os, sys, glob, unittest

print("── Pre-run Python Unit Tests (Phase 0 Preflight) ──")

def _setup_preflight_paths():
    """Discover project root (containing src/ and tests/) instantly without slow recursive filesystem walking."""
    # 1. Check known candidate paths directly (0.001s)
    cands = [
        os.environ.get("CPP_GRADER_ROOT", ""),
        "/kaggle/input/cpp-grader-code",
        "/kaggle/input/cpp-grader-code/cpp-grader-code",
        "/kaggle/working/cpp-grader-code",
        "/kaggle/working",
        os.path.join(os.getcwd(), "cpp-grader-code"),
        os.getcwd(),
    ]
    if "__file__" in globals():
        cands.append(os.path.dirname(os.path.abspath(__file__)))
        cands.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "cpp-grader-code"))

    # 2. Fast non-recursive check of attached datasets in /kaggle/input (depth 1 & 2 only)
    if os.path.isdir("/kaggle/input"):
        try:
            for item in os.listdir("/kaggle/input"):
                p = os.path.join("/kaggle/input", item)
                if os.path.isdir(p):
                    cands.append(p)
                    nested = os.path.join(p, "cpp-grader-code")
                    if os.path.isdir(nested):
                        cands.append(nested)
        except Exception:
            pass

    for root in cands:
        if root and os.path.isdir(root):
            has_tests = os.path.isfile(os.path.join(root, "tests", "test_pipeline.py"))
            has_src = os.path.isfile(os.path.join(root, "src", "schema.py"))
            if has_tests or has_src:
                if root not in sys.path:
                    sys.path.insert(0, root)
                return root

    # 3. Auto-recovery for Kaggle if network is enabled (with strict 10s timeout)
    if os.path.isdir("/kaggle/working") or "KAGGLE_KERNEL_RUN_TYPE" in os.environ:
        try:
            import subprocess
            repo_dest = "/kaggle/working/Quiz-Checker"
            if not os.path.isdir(repo_dest):
                print("[SETUP] Attempting automatic clone from GitHub (timeout 10s)...")
                subprocess.run(
                    ["git", "clone", "--depth", "1", "https://github.com/Muhammad-Istafa/Quiz-Checker.git", repo_dest],
                    check=True, capture_output=True, text=True, timeout=10
                )
            target = os.path.join(repo_dest, "cpp-grader-code")
            if os.path.isfile(os.path.join(target, "src", "schema.py")):
                if target not in sys.path:
                    sys.path.insert(0, target)
                return target
        except Exception as _clone_err:
            print(f"[WARN] Automatic git clone failed: {_clone_err}")

    return None

_detected_root = _setup_preflight_paths()
if _detected_root:
    print(f"[SETUP] Preflight detected project root at: {_detected_root}", flush=True)
else:
    print("[WARN] Could not find project root in standard paths. Attempting direct imports...", flush=True)

try:
    from tests.test_pipeline import run_unit_tests
    _success = run_unit_tests()
    assert _success, "Preflight Python unit tests failed! Halting pipeline execution immediately."
    print("✓ All Preflight Python Unit Tests Passed Successfully.", flush=True)
except ImportError as _imp_err:
    print(f"[WARN] tests/test_pipeline.py not importable ({_imp_err}), attempting embedded preflight suite...", flush=True)
    try:
        from src.schema import validate_grading_output
        from src.parse import extract_reasoning_and_json, parse_and_validate_output

        class _InlinePreflightTest(unittest.TestCase):
            def setUp(self):
                self.rubric = [{"id": "c1", "description": "Loop", "max_marks": 4.0}, {"id": "c2", "description": "Output", "max_marks": 3.0}]
                self.code = "1| int main() { for(int i=0; i<10; i++) cout << i; }"

            def test_json_and_no_clamp(self):
                sample = 'Thinking.\\n{"criteria": [{"id": "c1", "marks_awarded": 4.0, "justification": "ok", "evidence_lines": [1]}, {"id": "c2", "marks_awarded": 3.0, "justification": "ok", "evidence_lines": [1]}], "needs_human_review": false}'
                res = parse_and_validate_output(sample, self.rubric, self.code)
                self.assertTrue(res.is_valid)
                self.assertEqual(res.total_marks, 7.0)

                bad = 'Thinking.\\n{"criteria": [{"id": "c1", "marks_awarded": 5.0, "justification": "exceeded", "evidence_lines": [1]}, {"id": "c2", "marks_awarded": 3.0, "justification": "ok", "evidence_lines": [1]}], "needs_human_review": false}'
                res_bad = parse_and_validate_output(bad, self.rubric, self.code)
                self.assertFalse(res_bad.is_valid)
                self.assertEqual(res_bad.failure_reason, "out_of_range_marks")

        _suite = unittest.TestLoader().loadTestsFromTestCase(_InlinePreflightTest)
        _res = unittest.TextTestRunner(verbosity=2).run(_suite)
        assert _res.wasSuccessful(), "Embedded preflight unit tests failed!"
        print("✓ Embedded Preflight Python Unit Tests Passed Successfully.", flush=True)
    except ImportError:
        raise RuntimeError(
            "\\n" + "=" * 75 + "\\n"
            "[CRITICAL PREFLIGHT ERROR] Neither 'tests.test_pipeline' nor 'src' could be found!\\n"
            "To fix this in Kaggle:\\n"
            "  1. In the right panel under 'Input', click '+ Add Data'.\\n"
            "  2. Click 'Your Datasets' (or search for 'cpp-grader-code').\\n"
            "  3. Click the '+' button next to 'cpp-grader-code' to attach it to this notebook.\\n"
            "  4. Alternatively, enable Internet in Settings so the notebook can clone the code.\\n"
            "=" * 75
        )`;

function patchPreflightCell(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const startIdx = content.indexOf('print("── Pre-run Python Unit Tests (Phase 0 Preflight) ──")');
    if (startIdx === -1) {
        console.error('Could not find preflight start in', filePath);
        return;
    }
    const cellStart = content.lastIndexOf('# %%\n', startIdx);
    const nextCell = content.indexOf('\n# %%\n', startIdx);
    content = content.slice(0, cellStart) + FAST_PREFLIGHT + content.slice(nextCell);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Patched fast preflight cell in', filePath);
}

patchPreflightCell('nb1_data.py');
patchPreflightCell('cpp-grader-code/nb1_data.py');
patchPreflightCell('n0_audit.py');
patchPreflightCell('cpp-grader-code/n0_audit.py');

// 2. Patch real_sources.py resolve_repo_path to be depth 1-2 only (no glob.glob recursive across 60k files!)
function patchRealSources(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const oldResolveRegex = /def resolve_repo_path\(repo_name: str\) -> Optional\[str\]:[\s\S]*?return None\n/;
    const newResolve = `def resolve_repo_path(repo_name: str) -> Optional[str]:
    """Find local repository path, with fast offline Kaggle dataset fallback."""
    # 1. Local workspace path
    for base in ["repos", os.path.join("..", "repos"), "."]:
        cand = os.path.join(base, repo_name)
        if os.path.isdir(cand):
            return cand

    # 2. Fast non-recursive check in /kaggle/input (depth 1 and 2 only)
    if os.path.isdir("/kaggle/input"):
        direct = os.path.join("/kaggle/input", repo_name)
        if os.path.isdir(direct):
            return direct
        try:
            for ds in os.listdir("/kaggle/input"):
                p1 = os.path.join("/kaggle/input", ds, repo_name)
                if os.path.isdir(p1):
                    return p1
                p2 = os.path.join("/kaggle/input", ds, ds, repo_name)
                if os.path.isdir(p2):
                    return p2
        except Exception:
            pass

    return None
`;
    if (oldResolveRegex.test(content)) {
        content = content.replace(oldResolveRegex, newResolve);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Patched fast resolve_repo_path in', filePath);
    } else {
        console.error('Could not find resolve_repo_path in', filePath);
    }
}
patchRealSources('cpp-grader-code/src/real_sources.py');

// 3. Patch paths.py resolve_data_dir to avoid glob.glob /**/
function patchPaths(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const oldPathsPattern = 'found = sorted({os.path.dirname(p) for p in\n                    glob.glob(f"/kaggle/input/**/{required_file}", recursive=True)})';
    const newPathsPattern = `found = []
    if os.path.isdir("/kaggle/input"):
        try:
            for ds in os.listdir("/kaggle/input"):
                dsp = os.path.join("/kaggle/input", ds)
                if os.path.isfile(os.path.join(dsp, required_file)):
                    found.append(dsp)
                nested = os.path.join(dsp, ds)
                if os.path.isdir(nested) and os.path.isfile(os.path.join(nested, required_file)):
                    found.append(nested)
                nested_data = os.path.join(dsp, "cpp-grader-data-v2")
                if os.path.isdir(nested_data) and os.path.isfile(os.path.join(nested_data, required_file)):
                    found.append(nested_data)
        except Exception:
            pass
    found = sorted(set(found))`;
    if (content.includes(oldPathsPattern)) {
        content = content.replace(oldPathsPattern, newPathsPattern);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Patched fast resolve_data_dir in', filePath);
    } else {
        console.log('Paths pattern already updated or not found in', filePath);
    }
}
patchPaths('cpp-grader-code/src/paths.py');

// 4. Regenerate notebooks
pyToIpynb('cpp-grader-code/n0_audit.py', 'notebooks/n0_audit.ipynb');
pyToIpynb('cpp-grader-code/nb1_data.py', 'notebooks/nb1_data.ipynb');

console.log('All slow globs eliminated.');

