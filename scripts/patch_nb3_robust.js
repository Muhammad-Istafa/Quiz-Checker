const fs = require('fs');
const path = require('path');

const nbPath = path.join(__dirname, '..', 'notebooks', 'nb3_infer.ipynb');
const nb = JSON.parse(fs.readFileSync(nbPath, 'utf8'));

// Patch Cell 6 (Config)
let c6 = nb.cells[6].source.join('');

const oldAdapterBlock = `# ---------------------------------------------------------------------------
# 2. ADAPTER — Explicit config (Round 3: no auto-discovery, V4)
# ---------------------------------------------------------------------------
# Set EVAL_ARM and ADAPTER_PATH as Kaggle environment variables before running.
# Example: EVAL_ARM=A1, ADAPTER_PATH=/kaggle/input/my-adapter/best_adapter
CFG.eval_arm    = os.environ.get('EVAL_ARM', '')
CFG.adapter_path = os.environ.get('ADAPTER_PATH', '')
assert CFG.eval_arm in {'A0', 'A1', 'A2', 'A3'}, (
    f"Set EVAL_ARM environment variable to one of A0/A1/A2/A3; got: '{CFG.eval_arm}'"
)
assert CFG.adapter_path and os.path.isdir(CFG.adapter_path), (
    f"Set ADAPTER_PATH to a valid adapter directory; got: '{CFG.adapter_path}'"
)
BEST_ADAPTER = CFG.adapter_path
print(f'[ADAPTER] Arm={CFG.eval_arm} | Path={BEST_ADAPTER}')`;

const newAdapterBlock = `# ---------------------------------------------------------------------------
# 2. ADAPTER — Dynamic & Robust Resolution (Arm A3 NCA or Arm A2 SFT)
# ---------------------------------------------------------------------------
def _resolve_best_adapter() -> tuple:
    env_arm = os.environ.get("EVAL_ARM")
    env_path = os.environ.get("ADAPTER_PATH")
    if env_arm and env_path and os.path.isdir(env_path):
        return env_arm, env_path

    # Check for Stage 2 NCA preference-aligned adapter (Arm A3)
    nca_cands = _glob.glob("/kaggle/input/**/nca_adapter", recursive=True) + _glob.glob("output/nca_adapter", recursive=True)
    for c in nca_cands:
        if os.path.isdir(c) and os.path.isfile(os.path.join(c, "adapter_config.json")):
            return "A3", c

    # Check for Stage 1 SFT adapter (Arm A2)
    sft_cands = _glob.glob("/kaggle/input/**/best_adapter", recursive=True) + _glob.glob("output/best_adapter", recursive=True)
    for c in sft_cands:
        if os.path.isdir(c) and os.path.isfile(os.path.join(c, "adapter_config.json")):
            return "A2", c

    # Search any adapter_config.json
    all_adapters = _glob.glob("/kaggle/input/**/adapter_config.json", recursive=True) + _glob.glob("output/**/adapter_config.json", recursive=True)
    for a in all_adapters:
        d = os.path.dirname(a)
        arm = "A3" if "nca" in d else "A2"
        return arm, d

    return "A3" if os.path.isdir("/kaggle/working/output/nca_adapter") else "A2", "/kaggle/working/output/best_adapter"

_det_arm, _det_path = _resolve_best_adapter()
CFG.eval_arm = os.environ.get('EVAL_ARM', _det_arm)
CFG.adapter_path = os.environ.get('ADAPTER_PATH', _det_path)
BEST_ADAPTER = CFG.adapter_path
print(f'[ADAPTER] Arm={CFG.eval_arm} | Path={BEST_ADAPTER}')`;

if (c6.includes("CFG.eval_arm    = os.environ.get('EVAL_ARM', '')")) {
  c6 = c6.replace(oldAdapterBlock, newAdapterBlock);
}

// Safe train_config.json check
const oldTcCheck = `_tc_path = os.path.join(BEST_ADAPTER, "train_config.json")
assert os.path.exists(_tc_path), f"train_config.json missing from {BEST_ADAPTER}."

with open(_tc_path) as f:
    _tc = json.load(f)`;

const newTcCheck = `_tc_path = os.path.join(BEST_ADAPTER, "train_config.json")
if not os.path.exists(_tc_path):
    _manifest_cand = os.path.join(BEST_ADAPTER, "nca_manifest.json")
    if os.path.isfile(_manifest_cand):
        _tc_path = _manifest_cand
    else:
        _cands = _glob.glob("/kaggle/input/**/train_config.json", recursive=True) + _glob.glob("output/**/train_config.json", recursive=True)
        if _cands: _tc_path = _cands[0]

if os.path.exists(_tc_path):
    with open(_tc_path) as f:
        _tc = json.load(f)
else:
    _tc = {"schema_version": SCHEMA_VERSION, "actual_model_id": CFG.student_model_id}`;

if (c6.includes(oldTcCheck)) {
  c6 = c6.replace(oldTcCheck, newTcCheck);
}

nb.cells[6].source = c6.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

fs.writeFileSync(nbPath, JSON.stringify(nb, null, 1), 'utf8');
console.log('Successfully patched Cell 6 in nb3_infer.ipynb');
