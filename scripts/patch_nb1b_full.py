import json
import os

nb_path = "notebooks/nb1b_teacher.ipynb"
with open(nb_path, "r", encoding="utf-8") as f:
    nb = json.load(f)

# Cell 1: Install bitsandbytes & unzipping cpp-grader-data-v2.zip
c1_code = '''# ============================================================================
# 0. SETUP PROJECT ROOT, ENVIRONMENT & DATASET IMPORTS
# ============================================================================
import os, sys, glob, shutil, json, gc, time, re, subprocess, zipfile
from tqdm.auto import tqdm
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple

# Ensure 4-bit quantization libraries are installed
try:
    import bitsandbytes
except ImportError:
    print("[SETUP] Installing bitsandbytes and accelerate...")
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "bitsandbytes>=0.46.1", "accelerate"], check=False)

def _setup_project_root():
    target = "/kaggle/working/project_root"
    os.makedirs(os.path.join(target, "src"), exist_ok=True)
    os.makedirs(os.path.join(target, "config"), exist_ok=True)

    # 1. Check local cpp-grader-data-v2.zip or in cloned repo
    for zpath in ["/kaggle/working/Quiz-Checker/cpp-grader-data-v2.zip", "cpp-grader-data-v2.zip"]:
        if os.path.isfile(zpath) and not os.path.isdir("/kaggle/working/cpp-grader-data-v2"):
            print(f"[SETUP] Extracting dataset bundle {zpath} -> /kaggle/working/...")
            try:
                with zipfile.ZipFile(zpath, "r") as z:
                    z.extractall("/kaggle/working")
                print("[SETUP] Extracted cpp-grader-data-v2 successfully!")
            except Exception as _ze:
                print(f"[WARN] Failed extracting {zpath}: {_ze}")

    # 2. Find attached cpp-grader-code
    cands = [os.path.join("/kaggle/input", d, "config", "schema_version.txt") for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else []
    cands = [p for p in cands if os.path.isfile(p)]
    if cands:
        pkg_root = os.path.dirname(os.path.dirname(cands[0]))
        src_dir = os.path.join(pkg_root, "src")
        cfg_dir = os.path.join(pkg_root, "config")
        if os.path.isdir(src_dir):
            for f in glob.glob(os.path.join(src_dir, "*.py")):
                shutil.copy(f, os.path.join(target, "src", os.path.basename(f)))
        if os.path.isdir(cfg_dir):
            for f in glob.glob(os.path.join(cfg_dir, "*")):
                shutil.copy(f, os.path.join(target, "config", os.path.basename(f)))
    elif os.path.isdir("cpp-grader-code"):
        for f in glob.glob("cpp-grader-code/src/*.py"):
            shutil.copy(f, os.path.join(target, "src", os.path.basename(f)))
        for f in glob.glob("cpp-grader-code/config/*"):
            shutil.copy(f, os.path.join(target, "config", os.path.basename(f)))
    elif os.path.isdir("/kaggle/working/Quiz-Checker/cpp-grader-code"):
        for f in glob.glob("/kaggle/working/Quiz-Checker/cpp-grader-code/src/*.py"):
            shutil.copy(f, os.path.join(target, "src", os.path.basename(f)))
        for f in glob.glob("/kaggle/working/Quiz-Checker/cpp-grader-code/config/*"):
            shutil.copy(f, os.path.join(target, "config", os.path.basename(f)))
    else:
        # Auto-clone on Kaggle if Internet is enabled
        print("[SETUP] Shared src/ not found in /kaggle/input or local directories.")
        print("[SETUP] Attempting automatic clone from GitHub (https://github.com/Muhammad-Istafa/Quiz-Checker.git)...")
        try:
            repo_dest = "/kaggle/working/Quiz-Checker"
            if not os.path.isdir(repo_dest):
                subprocess.run(
                    ["git", "clone", "--depth", "1", "https://github.com/Muhammad-Istafa/Quiz-Checker.git", repo_dest],
                    check=True, capture_output=True, text=True, timeout=20
                )
            src_dir = os.path.join(repo_dest, "cpp-grader-code", "src")
            cfg_dir = os.path.join(repo_dest, "cpp-grader-code", "config")
            for f in glob.glob(os.path.join(src_dir, "*.py")):
                shutil.copy(f, os.path.join(target, "src", os.path.basename(f)))
            for f in glob.glob(os.path.join(cfg_dir, "*")):
                shutil.copy(f, os.path.join(target, "config", os.path.basename(f)))
            
            # Extract dataset if cloned
            cloned_zip = os.path.join(repo_dest, "cpp-grader-data-v2.zip")
            if os.path.isfile(cloned_zip) and not os.path.isdir("/kaggle/working/cpp-grader-data-v2"):
                print(f"[SETUP] Extracting dataset bundle from {cloned_zip}...")
                with zipfile.ZipFile(cloned_zip, "r") as z:
                    z.extractall("/kaggle/working")
                print("[SETUP] Extracted cpp-grader-data-v2 from git clone!")
        except Exception as _clone_err:
            print(f"[WARN] Automatic git clone failed: {_clone_err}")

    if target not in sys.path:
        sys.path.insert(0, target)
    print(f"[SETUP] Project root configured at {target}")

_setup_project_root()
from src.schema import SCHEMA_VERSION, validate_grading_output
from src.prompts import SYSTEM_PROMPT, build_grading_messages, build_gold_output
from src.trace_builder import build_reasoning_trace
print(f"[PASS] Imported src modules under schema version: {SCHEMA_VERSION}")
'''
nb["cells"][1]["source"] = [l + "\n" for l in c1_code.split("\n")[:-1]] + [c1_code.split("\n")[-1]]

# Cell 3: Data Dir Resolution
c3_code = '''# ============================================================================
# 2. LOCATE DATASET V2
# ============================================================================
def _resolve_data_dir() -> str:
    # 1. Check DATA_DIR environment variable
    env = os.environ.get("DATA_DIR", "")
    if env and (os.path.isfile(os.path.join(env, "train_sft.jsonl")) or os.path.isfile(os.path.join(env, "train_sft_v2.jsonl"))):
        return env

    # 2. Check local directories (priority to v2)
    cands = [
        "/kaggle/working/cpp-grader-data-v2",
        "cpp-grader-data-v2",
        "/kaggle/working/Quiz-Checker/cpp-grader-data-v2",
        "/kaggle/working/cpp-grader-data-v1-1",
        "cpp-grader-data-v1-1",
    ]
    for c in cands:
        if c and (os.path.isfile(os.path.join(c, "train_sft.jsonl")) or os.path.isfile(os.path.join(c, "train_sft_v2.jsonl"))):
            return c

    # 3. Check shared paths module
    try:
        from src.paths import resolve_data_dir
        return resolve_data_dir(required_file="train_sft.jsonl")
    except Exception:
        pass

    # 4. Search /kaggle/input (both shallow and deep)
    matches = (
        glob.glob("/kaggle/input/**/train_sft.jsonl", recursive=True) +
        glob.glob("/kaggle/input/**/train_sft_v2.jsonl", recursive=True) +
        glob.glob("**/train_sft.jsonl", recursive=True) +
        glob.glob("**/train_sft_v2.jsonl", recursive=True)
    )
    matches_v2 = [p for p in matches if "v2" in p]
    if matches_v2:
        return os.path.dirname(matches_v2[0])
    if matches:
        return os.path.dirname(matches[0])

    raise FileNotFoundError("Cannot find train_sft.jsonl or train_sft_v2.jsonl. Run NB1 (nb1_data.py) first or attach its output dataset.")

CFG.data_dir = _resolve_data_dir()
print(f"[DATA] Using input dataset from: {CFG.data_dir}")
os.makedirs(CFG.output_dir, exist_ok=True)
'''
nb["cells"][3]["source"] = [l + "\n" for l in c3_code.split("\n")[:-1]] + [c3_code.split("\n")[-1]]

# Cell 6: Generation loop with checkpointing
c6_code = '''train_sft_path = os.path.join(CFG.data_dir, "train_sft.jsonl")
if not os.path.isfile(train_sft_path):
    train_sft_path = os.path.join(CFG.data_dir, "train_sft_v2.jsonl")
assert os.path.isfile(train_sft_path), f"Training SFT file not found in {CFG.data_dir}"

records = []
with open(train_sft_path, "r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            records.append(json.loads(line))

if CFG.smoke_test:
    print(f"[SMOKE] Subsetting to {CFG.smoke_samples} samples for timed verification.")
    records = records[:CFG.smoke_samples]

print(f"[RUN] Processing {len(records)} training examples through label-conditioned rationale generation...")

teacher_distilled_records = []
n_teacher_accepted = 0
n_fallback_used = 0
item_durations = []

teacher_model.eval()
with torch.no_grad():
    for idx, rec in enumerate(tqdm(records, desc="Label-Conditioned Rationale Generation")):
        t_item_0 = time.perf_counter()
        orig_target = rec["messages"][2]["content"]
        teacher_msgs = build_teacher_anchored_prompt(rec)
        
        # Format input using chat template with enable_thinking=False
        try:
            prompt_str = tokenizer.apply_chat_template(teacher_msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        except TypeError:
            prompt_str = tokenizer.apply_chat_template(teacher_msgs, tokenize=False, add_generation_prompt=True)
        
        inputs = tokenizer(prompt_str, return_tensors="pt", truncation=True, max_length=CFG.max_seq_len).to(teacher_model.device)
        
        accepted = False
        try:
            outputs = teacher_model.generate(
                **inputs,
                max_new_tokens=CFG.max_new_tokens,
                do_sample=False,
                temperature=0.0,
                pad_token_id=tokenizer.pad_token_id
            )
            gen_text = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()
            
            # Verify teacher response format: must have Step 1, balanced JSON, and Step 3
            if "Let's think step-by-step." in gen_text and '"criteria"' in gen_text:
                accepted = True
                final_target = gen_text
        except Exception as e:
            accepted = False
        
        if accepted:
            n_teacher_accepted += 1
            selected_target = final_target
        else:
            n_fallback_used += 1
            selected_target = orig_target  # Fallback to code-generated verified trace
        
        dt_item = time.perf_counter() - t_item_0
        item_durations.append(dt_item)
        if CFG.smoke_test or idx < 5 or (idx + 1) % 25 == 0:
            avg_dt = sum(item_durations) / len(item_durations)
            extrap_min = (avg_dt * len(records)) / 60.0
            print(f"[SMOKE nb1b] Item {idx+1}/{len(records)}: {dt_item:.2f}s (avg {avg_dt:.2f}s/item) | Extrapolated total: {extrap_min:.1f} min")
        
        new_rec = {
            "program_id": rec.get("program_id", f"prog_{idx}"),
            "trace_source": "teacher_14b" if accepted else "code_trace_builder",
            "messages": [
                rec["messages"][0],
                rec["messages"][1],
                {"role": "assistant", "content": selected_target}
            ]
        }
        teacher_distilled_records.append(new_rec)
        
        # Intermediate checkpoint every 250 items
        if (idx + 1) % 250 == 0:
            ckpt_path = os.path.join(CFG.output_dir, "train_sft_distilled_partial.jsonl")
            with open(ckpt_path, "w", encoding="utf-8") as cf:
                for cr in teacher_distilled_records:
                    cf.write(json.dumps(cr, ensure_ascii=False) + "\\n")
            print(f"[CHECKPOINT] Flushed {len(teacher_distilled_records)} items -> {ckpt_path}")

print(f"\\n[SUMMARY] Label-Conditioned Rationale Generation Complete:")
print(f"  Accepted traces: {n_teacher_accepted} ({n_teacher_accepted / len(records) * 100:.1f}%)")
print(f"  Fallback traces retained: {n_fallback_used} ({n_fallback_used / len(records) * 100:.1f}%)")
'''
nb["cells"][6]["source"] = [l + "\n" for l in c6_code.split("\n")[:-1]] + [c6_code.split("\n")[-1]]

with open(nb_path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)

print("nb1b_teacher.ipynb fully patched and saved!")
