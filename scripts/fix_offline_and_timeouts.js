const fs = require('fs');
const { pyToIpynb } = require('./py_to_ipynb.js');

function fixGitTimeouts(content) {
  // Add timeout=10 to subprocess.run(["git", "clone", ...])
  return content.replace(
    /(subprocess\.run\(\s*\["git",\s*"clone"[^\]]*\],\s*check=True,\s*capture_output=True,\s*text=True)(\s*\))/g,
    '$1, timeout=10$2'
  );
}

// 1. Fix nb1_data.py
function fixNb1(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace Cell 3 install block with offline-safe dependency check
  const oldInstallRegex = /# ============================================================================\s*# 0A\. INSTALL[\s\S]*?print\(f"\s*\{_pkg:20s\}\s*ERROR: \{_e\}"\)/;
  const newInstall = `# ============================================================================
# 0A. DEPENDENCY CHECK (idempotent, offline-ready)
# ============================================================================
import sys, importlib

print("Verifying core dependencies for data generation...")
_CORE_PKGS = ["huggingface_hub", "transformers", "tqdm", "numpy"]
for _pkg in _CORE_PKGS:
    try:
        _m = importlib.import_module(_pkg)
        print(f"  {_pkg:20s}  {getattr(_m, '__version__', 'ok')}")
    except ImportError:
        print(f"  {_pkg:20s}  [WARN] Not found; attempting offline/standard install...")
        try:
            import subprocess
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", _pkg], timeout=15)
        except Exception as _pe:
            print(f"  {_pkg:20s}  Could not install: {_pe}")
print("Core environment dependencies verified.", flush=True)`;

  if (oldInstallRegex.test(content)) {
    content = content.replace(oldInstallRegex, newInstall);
    console.log('Replaced 0A. INSTALL in', filePath);
  } else {
    console.log('Could not find 0A. INSTALL in', filePath);
  }

  content = fixGitTimeouts(content);
  fs.writeFileSync(filePath, content, 'utf8');
}

fixNb1('nb1_data.py');
fixNb1('cpp-grader-code/nb1_data.py');

// 2. Fix n0_audit.py git timeouts
function fixN0(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = fixGitTimeouts(content);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed git timeouts in', filePath);
}
fixN0('n0_audit.py');
fixN0('cpp-grader-code/n0_audit.py');

// 3. Fix nb1b_teacher.ipynb
let nb1b = JSON.parse(fs.readFileSync('notebooks/nb1b_teacher.ipynb', 'utf8'));
nb1b.cells.forEach(c => {
  if (c.cell_type === 'code') {
    let src = Array.isArray(c.source) ? c.source.join('') : c.source;
    if (src.includes('git') && src.includes('clone') && !src.includes('timeout=')) {
      src = fixGitTimeouts(src);
      c.source = src.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);
      console.log('Fixed git timeout in nb1b_teacher.ipynb');
    }
  }
});
fs.writeFileSync('notebooks/nb1b_teacher.ipynb', JSON.stringify(nb1b, null, 1), 'utf8');

// 4. Fix nb2_train.ipynb
let nb2 = JSON.parse(fs.readFileSync('notebooks/nb2_train.ipynb', 'utf8'));
nb2.cells.forEach(c => {
  if (c.cell_type === 'code') {
    let src = Array.isArray(c.source) ? c.source.join('') : c.source;
    if (src.includes('0A. INSTALL')) {
      src = `# ============================================================================
# 0A. DEPENDENCY CHECK & INSTALL (idempotent, offline-resilient)
# ============================================================================
import subprocess, sys, importlib

print("Verifying training dependencies …")
_REQUIRED = ["bitsandbytes", "peft", "accelerate"]
_missing = []
for _p in _REQUIRED:
    try:
        importlib.import_module(_p)
    except ImportError:
        _missing.append(_p)

if _missing:
    print(f"Installing missing dependencies: {_missing}...")
    try:
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-q"
        ] + [p if p != "bitsandbytes" else "bitsandbytes>=0.46.1" for p in _missing], timeout=120)
    except Exception as _e:
        print(f"[WARN] Failed to install {_missing} ({_e}). Check Internet settings if packages are missing.")

importlib.invalidate_caches()

# Record package versions for train_meta.json
ENV_VERSIONS = {}
for _pkg in ["torch", "transformers", "peft", "accelerate", "bitsandbytes", "huggingface_hub"]:
    try:
        _m = importlib.import_module(_pkg)
        ENV_VERSIONS[_pkg] = getattr(_m, "__version__", "unknown")
        print(f"  {_pkg:20s}  {ENV_VERSIONS[_pkg]}")
    except Exception as _e:
        ENV_VERSIONS[_pkg] = f"error: {_e}"
        print(f"  {_pkg:20s}  ERROR: {_e}")
`;
      c.source = src.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);
      console.log('Replaced 0A. INSTALL in nb2_train.ipynb');
    }
    if (src.includes('git') && src.includes('clone') && !src.includes('timeout=')) {
      src = fixGitTimeouts(src);
      c.source = src.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);
      console.log('Fixed git timeout in nb2_train.ipynb');
    }
  }
});
fs.writeFileSync('notebooks/nb2_train.ipynb', JSON.stringify(nb2, null, 1), 'utf8');

// 5. Fix nb3_infer.ipynb
let nb3 = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));
nb3.cells.forEach(c => {
  if (c.cell_type === 'code') {
    let src = Array.isArray(c.source) ? c.source.join('') : c.source;
    if (src.includes('0A. INSTALL')) {
      src = `# ============================================================================
# 0A. DEPENDENCY CHECK & INSTALL (idempotent, offline-resilient)
# ============================================================================
import subprocess, sys, importlib

print("Verifying inference dependencies …")
_REQUIRED = ["peft", "accelerate", "bitsandbytes"]
_missing = []
for _p in _REQUIRED:
    try:
        importlib.import_module(_p)
    except ImportError:
        _missing.append(_p)

if _missing:
    print(f"Installing missing dependencies: {_missing}...")
    try:
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-q"
        ] + [p if p != "bitsandbytes" else "bitsandbytes>=0.45.0" for p in _missing], timeout=120)
    except Exception as _e:
        print(f"[WARN] Failed to install {_missing} ({_e}). Check Internet settings if packages are missing.")

importlib.invalidate_caches()

for _pkg in ["huggingface_hub", "bitsandbytes", "peft", "transformers", "sklearn"]:
    try:
        _m = importlib.import_module(_pkg)
        print(f"  {_pkg:20s}  {getattr(_m,'__version__','?')}")
    except Exception as _e:
        print(f"  {_pkg:20s}  ERROR: {_e}")
`;
      c.source = src.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);
      console.log('Replaced 0A. INSTALL in nb3_infer.ipynb');
    }
    if (src.includes('git') && src.includes('clone') && !src.includes('timeout=')) {
      src = fixGitTimeouts(src);
      c.source = src.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);
      console.log('Fixed git timeout in nb3_infer.ipynb');
    }
  }
});
fs.writeFileSync('notebooks/nb3_infer.ipynb', JSON.stringify(nb3, null, 1), 'utf8');

// 6. Regenerate n0_audit.ipynb and nb1_data.ipynb
pyToIpynb('cpp-grader-code/n0_audit.py', 'notebooks/n0_audit.ipynb');
pyToIpynb('cpp-grader-code/nb1_data.py', 'notebooks/nb1_data.ipynb');

console.log('All offline and timeout fixes applied.');

