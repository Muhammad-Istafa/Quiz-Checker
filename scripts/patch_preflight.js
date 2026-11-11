const fs = require('fs');
const path = require('path');
const { pyToIpynb } = require('./py_to_ipynb.js');

const NEW_CELL_1 = `# %%
import os, sys, glob, unittest

print("── Pre-run Python Unit Tests (Phase 0 Preflight) ──")

def _setup_preflight_paths():
    """Discover project root (containing src/ and tests/) across Kaggle and local environments."""
    cands = [os.environ.get("CPP_GRADER_ROOT", "")]
    if "__file__" in globals():
        cands.append(os.path.dirname(os.path.abspath(__file__)))
        cands.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "cpp-grader-code"))
    cands += [
        os.getcwd(),
        os.path.join(os.getcwd(), "cpp-grader-code"),
        os.path.join(os.getcwd(), "Quiz-Checker", "cpp-grader-code"),
        "/kaggle/working",
        "/kaggle/working/cpp-grader-code",
        "/kaggle/working/Quiz-Checker/cpp-grader-code",
        "/kaggle/input/cpp-grader-code",
        "/kaggle/input/cpp-grader-code/cpp-grader-code",
    ]
    # Scan /kaggle/input for attached code dataset
    for match in glob.glob("/kaggle/input/**/tests/test_pipeline.py", recursive=True):
        cands.append(os.path.dirname(os.path.dirname(os.path.abspath(match))))
    for match in glob.glob("/kaggle/input/**/src/schema.py", recursive=True):
        cands.append(os.path.dirname(os.path.dirname(os.path.abspath(match))))
    for match in glob.glob("/kaggle/input/**/schema_version.txt", recursive=True):
        cands.append(os.path.dirname(os.path.dirname(os.path.abspath(match))))
    for match in glob.glob("**/src/schema.py", recursive=True):
        cands.append(os.path.dirname(os.path.dirname(os.path.abspath(match))))

    for root in cands:
        if root and os.path.isdir(root):
            has_tests = os.path.isfile(os.path.join(root, "tests", "test_pipeline.py"))
            has_src = os.path.isfile(os.path.join(root, "src", "schema.py"))
            if has_tests or has_src:
                if root not in sys.path:
                    sys.path.insert(0, root)
                return root

    # Auto-recovery for Kaggle if network is enabled
    if os.path.isdir("/kaggle/working") or "KAGGLE_KERNEL_RUN_TYPE" in os.environ:
        try:
            import subprocess
            repo_dest = "/kaggle/working/Quiz-Checker"
            if not os.path.isdir(repo_dest):
                print("[SETUP] Attempting automatic clone from GitHub (https://github.com/Muhammad-Istafa/Quiz-Checker.git)...")
                subprocess.run(
                    ["git", "clone", "--depth", "1", "https://github.com/Muhammad-Istafa/Quiz-Checker.git", repo_dest],
                    check=True, capture_output=True, text=True
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
    print(f"[SETUP] Preflight detected project root at: {_detected_root}")
else:
    print("[WARN] Could not find project root in standard paths. Attempting direct imports...")

try:
    from tests.test_pipeline import run_unit_tests
    _success = run_unit_tests()
    assert _success, "Preflight Python unit tests failed! Halting pipeline execution immediately."
    print("✓ All Preflight Python Unit Tests Passed Successfully.")
except ImportError as _imp_err:
    print(f"[WARN] tests/test_pipeline.py not importable ({_imp_err}), attempting embedded preflight suite...")
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
        print("✓ Embedded Preflight Python Unit Tests Passed Successfully.")
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

function patchFile(filePath, isN0) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace the cell starting with 'import os, sys, unittest\n\nprint("── Pre-run Python Unit Tests' up to the end of that cell
    const startIdx = content.indexOf('print("── Pre-run Python Unit Tests (Phase 0 Preflight) ──")');
    if (startIdx === -1) {
        console.error('Could not find preflight start in', filePath);
        return false;
    }
    // Find the '# %%' before startIdx
    const cellStart = content.lastIndexOf('# %%\n', startIdx);
    if (cellStart === -1) {
        console.error('Could not find cell start # %% in', filePath);
        return false;
    }
    // Find the next '# %%'
    const nextCell = content.indexOf('\n# %%\n', startIdx);
    if (nextCell === -1) {
        console.error('Could not find next cell # %% in', filePath);
        return false;
    }

    content = content.slice(0, cellStart) + NEW_CELL_1 + content.slice(nextCell);

    // Also update _find_repo_root / _find_project_root to check _detected_root
    if (isN0) {
        const rootFinderMarker = 'def _find_repo_root() -> str:\n    """Folder with src/schema.py: CPP_GRADER_ROOT, this file\'s folder, cwd, or one attached Kaggle dataset."""';
        const rootFinderRepl = rootFinderMarker + '\n    if "_detected_root" in globals() and _detected_root and os.path.isfile(os.path.join(_detected_root, "src", "schema.py")):\n        return _detected_root';
        if (content.includes(rootFinderMarker) && !content.includes(rootFinderRepl)) {
            content = content.replace(rootFinderMarker, rootFinderRepl);
        }
    } else {
        const rootFinderMarker = 'def _find_project_root() -> str:\n    """Folder that contains src/schema.py and config/schema_version.txt."""';
        const rootFinderRepl = rootFinderMarker + '\n    if "_detected_root" in globals() and _detected_root and os.path.isfile(os.path.join(_detected_root, "src", "schema.py")):\n        return _detected_root';
        if (content.includes(rootFinderMarker) && !content.includes(rootFinderRepl)) {
            content = content.replace(rootFinderMarker, rootFinderRepl);
        }
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully patched', filePath);
    return true;
}

// 1. Patch n0_audit.py and cpp-grader-code/n0_audit.py
patchFile('n0_audit.py', true);
patchFile('cpp-grader-code/n0_audit.py', true);

// 2. Patch nb1_data.py and cpp-grader-code/nb1_data.py
patchFile('nb1_data.py', false);
patchFile('cpp-grader-code/nb1_data.py', false);

// 3. Re-generate notebooks
pyToIpynb('cpp-grader-code/n0_audit.py', 'notebooks/n0_audit.ipynb');
pyToIpynb('cpp-grader-code/nb1_data.py', 'notebooks/nb1_data.ipynb');

console.log('All files patched and notebooks regenerated.');

