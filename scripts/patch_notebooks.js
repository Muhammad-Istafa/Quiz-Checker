const fs = require('fs');

// 1. Patch nb2_train.ipynb
console.log('Patching notebooks/nb2_train.ipynb...');
const nb2 = JSON.parse(fs.readFileSync('notebooks/nb2_train.ipynb', 'utf8'));

// Patch Cell 6
const newCell6Source = `# ============================================================================
# 0C-bis. SHARED CODE (src/ — one copy of schema, prompt and paths; README §5)
# ============================================================================
import os, sys, glob as _glob, shutil, importlib

# Clear stale cached modules from previous cell attempts
for _m in list(sys.modules.keys()):
    if _m == "src" or _m.startswith("src."):
        sys.modules.pop(_m, None)
importlib.invalidate_caches()

def _setup_project_root() -> str:
    """Locate or stage src/ + config/ layout for import."""
    pkg_dir = "/kaggle/working/cpp_grader_pkg" if os.path.isdir("/kaggle/working") else os.path.join(os.getcwd(), "cpp_grader_pkg")
    os.makedirs(os.path.join(pkg_dir, "src"), exist_ok=True)
    os.makedirs(os.path.join(pkg_dir, "config"), exist_ok=True)

    # Check candidate roots
    cands = []
    if os.environ.get("CPP_GRADER_ROOT") and os.path.isdir(os.environ["CPP_GRADER_ROOT"]):
        cands.append(os.environ["CPP_GRADER_ROOT"])
    cands += [os.getcwd(), os.path.join(os.getcwd(), "cpp-grader-code"), "/kaggle/working"]
    cands += sorted({os.path.dirname(os.path.dirname(p))
                     for p in _glob.glob("/kaggle/input/**/src/schema.py", recursive=True)})
    cands += sorted({os.path.dirname(p)
                     for p in _glob.glob("/kaggle/input/**/schema.py", recursive=True)})

    for root in cands:
        if os.path.abspath(root) == os.path.abspath(pkg_dir):
            continue
        s_path = os.path.join(root, "src", "schema.py") if os.path.isfile(os.path.join(root, "src", "schema.py")) else os.path.join(root, "schema.py")
        v_path = os.path.join(root, "config", "schema_version.txt") if os.path.isfile(os.path.join(root, "config", "schema_version.txt")) else os.path.join(root, "schema_version.txt")
        if os.path.isfile(s_path) and os.path.isfile(v_path):
            src_source = os.path.join(root, "src") if os.path.isdir(os.path.join(root, "src")) else root
            cfg_source = os.path.join(root, "config") if os.path.isdir(os.path.join(root, "config")) else root

            # Copy all python source modules (prompts.py, schema.py, parse.py, etc.)
            for fn in os.listdir(src_source):
                if fn.endswith(".py"):
                    src_f = os.path.join(src_source, fn)
                    dst_f = os.path.join(pkg_dir, "src", fn)
                    if os.path.abspath(src_f) != os.path.abspath(dst_f):
                        shutil.copy2(src_f, dst_f)

            # Copy schema_version.txt
            if os.path.isfile(os.path.join(cfg_source, "schema_version.txt")):
                dst_v = os.path.join(pkg_dir, "config", "schema_version.txt")
                if os.path.abspath(os.path.join(cfg_source, "schema_version.txt")) != os.path.abspath(dst_v):
                    shutil.copy2(os.path.join(cfg_source, "schema_version.txt"), dst_v)
            return pkg_dir

    # If already staged in pkg_dir
    if (os.path.isfile(os.path.join(pkg_dir, "src", "schema.py"))
            and os.path.isfile(os.path.join(pkg_dir, "config", "schema_version.txt"))):
        return pkg_dir

    raise RuntimeError(
        f"Shared src/ + config/ not found in {cands}. Attach cpp-grader-code or set CPP_GRADER_ROOT."
    )

PROJECT_ROOT = _setup_project_root()
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

print(f"Shared code: {PROJECT_ROOT}")

from src.schema import SCHEMA_VERSION, validate_grading_output
from src.prompts import SYSTEM_PROMPT
from src.paths import resolve_data_dir
`;
nb2.cells[6].source = newCell6Source.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// Patch Cell 7 (Remove hardcoded legacy path override)
let cell7Text = Array.isArray(nb2.cells[7].source) ? nb2.cells[7].source.join('') : nb2.cells[7].source;
cell7Text = cell7Text.replace(
    /import os as _os\s*_NB1_DATA = "\/kaggle\/input\/datasets\/muhammadistafa\/synthetic-data\/data_v1_1"\s*if _os\.path\.isdir\(_NB1_DATA\):\s*os\.environ\["DATA_DIR"\] = _NB1_DATA\s*print\(f"\[CONFIG\] DATA_DIR forced → {_NB1_DATA}"\)/g,
    '# Dynamic data directory resolved via src.paths.resolve_data_dir()'
);
nb2.cells[7].source = cell7Text.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

fs.writeFileSync('notebooks/nb2_train.ipynb', JSON.stringify(nb2, null, 1), 'utf8');
console.log('[PASS] notebooks/nb2_train.ipynb patched.');

// 2. Patch nb3_infer.ipynb
console.log('Patching notebooks/nb3_infer.ipynb...');
const nb3 = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

// Patch Cell 16
let cell16Text = Array.isArray(nb3.cells[16].source) ? nb3.cells[16].source.join('') : nb3.cells[16].source;

const oldParserBlockPattern = /# Deterministic 3-step parser integration from src\.parse[\s\S]*?m = re\.search\(r'\{.*\}', clean, re\.DOTALL\)\s*if m:\s*clean = m\.group\(\)/;

const newParserBlock = `# Deterministic 3-step parser integration from src.parse
try:
    from src.parse import parse_and_validate_output as _parse_v2
except Exception:
    _parse_v2 = None

    # Parse with strict deterministic parser if available
    reasoning_text = ""
    feedback_text = ""
    if _parse_v2 is not None:
        try:
            p_res = _parse_v2(raw_json, rubric, student_answer)
            reasoning_text = p_res.reasoning if hasattr(p_res, "reasoning") else p_res.get("reasoning", "")
            feedback_text = p_res.feedback if hasattr(p_res, "feedback") else p_res.get("feedback", "")
            result["reasoning"] = reasoning_text
            result["feedback"] = feedback_text
            result["failure_types"] = p_res.failure_types if hasattr(p_res, "failure_types") else ([p_res.get("failure_reason")] if p_res.get("failure_reason") else [])

            is_ok = p_res.is_valid if hasattr(p_res, "is_valid") else p_res.get("valid", False)
            if is_ok:
                result["schema_valid_raw"] = True
                result["schema_valid_final"] = True
                criteria = p_res.criteria if hasattr(p_res, "criteria") else (p_res.get("parsed") or {}).get("criteria", [])
                total = p_res.total_marks if hasattr(p_res, "total_marks") else (p_res.get("parsed") or {}).get("total", 0.0)
                nhr = p_res.needs_human_review if hasattr(p_res, "needs_human_review") else (p_res.get("parsed") or {}).get("needs_human_review", False)
                result["parsed"] = {
                    "criteria": criteria,
                    "total": total,
                    "needs_human_review": nhr,
                }
                result["needs_human_review"] = nhr
                return result
        except Exception as _parse_err:
            logger.debug(f"_parse_v2 error ({_parse_err}); falling back.")

    # Fallback extraction: robust JSON block extraction with balanced braces
    clean = raw_json.strip()
    if "\`\`\`json" in clean:
        clean = clean.split("\`\`\`json")[-1].split("\`\`\`")[0].strip()
    elif "\`\`\`" in clean:
        parts = clean.split("\`\`\`")
        clean = parts[1].strip() if len(parts) > 1 else clean

    crit_idx = clean.find('"criteria"')
    if crit_idx != -1:
        start_brace = clean.rfind("{", 0, crit_idx)
        if start_brace != -1:
            depth = 0
            in_str = False
            esc = False
            end_brace = -1
            for i in range(start_brace, len(clean)):
                ch = clean[i]
                if esc:
                    esc = False
                    continue
                if ch == "\\\\":
                    esc = True
                    continue
                if ch == '"':
                    in_str = not in_str
                    continue
                if not in_str:
                    if ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            end_brace = i + 1
                            break
            if end_brace != -1:
                clean = clean[start_brace:end_brace]
    else:
        m = re.search(r'\\{.*\\}', clean, re.DOTALL)
        if m:
            clean = m.group()`;

cell16Text = cell16Text.replace(oldParserBlockPattern, newParserBlock);
nb3.cells[16].source = cell16Text.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// Patch Cell 39 (Add search fallback for quiz3_split.json)
let cell39Text = Array.isArray(nb3.cells[39].source) ? nb3.cells[39].source.join('') : nb3.cells[39].source;
cell39Text = cell39Text.replace(
    'split_file = "quiz3_split.json"',
    `split_file = "quiz3_split.json"
    if not os.path.isfile(split_file):
        _split_cands = _glob.glob("/kaggle/input/**/quiz3_split.json", recursive=True)
        if _split_cands:
            split_file = _split_cands[0]`
);
nb3.cells[39].source = cell39Text.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

fs.writeFileSync('notebooks/nb3_infer.ipynb', JSON.stringify(nb3, null, 1), 'utf8');
console.log('[PASS] notebooks/nb3_infer.ipynb patched.');

