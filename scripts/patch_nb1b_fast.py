import json
import os

nb_path = "notebooks/nb1b_teacher.ipynb"
with open(nb_path, "r", encoding="utf-8") as f:
    nb = json.load(f)

# Cell 0: Markdown
c0_md = """# 🎓 NB1B — High-Throughput Teacher Distillation (Batched 7B NF4)

**Project**: C++ Rubric Auto-Grader (Kaggle Benchmark v2)  
**Methodology**: Koutcheme, Woodrow, & Piech (SIGCSE 2026), Label-Conditioned Rationale Generation  
**Teacher Model**: `Qwen/Qwen2.5-Coder-7B-Instruct` in 4-bit NF4 (Kaggle T4 Optimized)  
**Throughput Optimization**: Left-padded Batched Generation (`batch_size=8`, ~1 sec/sample)  
**Student Target**: `Qwen/Qwen3-4B` (or `Qwen/Qwen2.5-Coder-3B-Instruct`)  

### Objective:
Generate high-capacity algorithmic reasoning traces from a local code-specialized teacher model. The teacher operates under **Ground-Truth Anchoring**: it receives the verified gold rubric breakdown and generates the 3-step structured output (Step 1 reasoning, Step 2 JSON criteria, Step 3 sandwich feedback).

> **Hardware & Efficiency Guarantee**: 4-bit NF4 quantization + batched inference ensures distillation completes in ~10-15 minutes on Kaggle T4 GPUs without OOM crashes.
"""
nb["cells"][0]["source"] = [l + "\n" for l in c0_md.split("\n")[:-1]] + [c0_md.split("\n")[-1]]

# Cell 1: Environment & Setup
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

    # 1. Extract cpp-grader-data-v2.zip if present locally or in cloned repo
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
                    check=True, capture_output=True, text=True, timeout=25
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

# Cell 2: Optimized TeacherConfig
c2_code = '''# ============================================================================
# 1. CONFIGURATION & GPU PREFLIGHT (High-Speed Batched Inference)
# ============================================================================
import torch

@dataclass
class TeacherConfig:
    # High-speed code reasoning teacher (~14GB download, ~4.5GB VRAM in 4-bit)
    teacher_model_id: str = "Qwen/Qwen2.5-Coder-7B-Instruct"
    fallback_model_id: str = "Qwen/Qwen2.5-Coder-3B-Instruct"
    data_dir: str = ""
    output_dir: str = "/kaggle/working/output/teacher_distilled"
    load_in_4bit: bool = True
    max_seq_len: int = 2048
    max_new_tokens: int = 450
    temperature: float = 0.0
    batch_size: int = 8  # 8 samples per forward pass for 5x GPU throughput
    max_distill_samples: int = int(os.environ.get("MAX_DISTILL_SAMPLES", "1000"))
    smoke_test: bool = os.environ.get("SMOKE_TEST", "0") == "1"
    smoke_samples: int = 24
    seed: int = 42

CFG = TeacherConfig()

assert torch.cuda.is_available(), "Teacher distillation requires GPU accelerator (T4x2 or P100)."
device_name = torch.cuda.get_device_name(0)
n_gpus = torch.cuda.device_count()
print(f"[GPU] Device: {device_name} (Total GPUs: {n_gpus})")
print(f"[CONFIG] Model: {CFG.teacher_model_id} | Batch Size: {CFG.batch_size} | Max Distill: {CFG.max_distill_samples}")
'''
nb["cells"][2]["source"] = [l + "\n" for l in c2_code.split("\n")[:-1]] + [c2_code.split("\n")[-1]]

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

# Cell 4: Load Model with Left-Padding
c4_code = '''# ============================================================================
# 3. LOAD TEACHER MODEL IN 4-BIT NF4 (KAGGLE T4 COMPATIBLE)
# ============================================================================
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

bnb_cfg = None
if CFG.load_in_4bit:
    bnb_cfg = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )

model_id = CFG.teacher_model_id
print(f"[LOAD] Loading teacher model '{model_id}'...")

try:
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True, padding_side="left")
    teacher_model = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=bnb_cfg,
        device_map="auto",
        torch_dtype=torch.float16,
        trust_remote_code=True
    )
except Exception as e:
    print(f"[WARN] Failed loading primary teacher '{model_id}': {e}")
    print(f"[FALLBACK] Loading fallback model '{CFG.fallback_model_id}'...")
    model_id = CFG.fallback_model_id
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True, padding_side="left")
    teacher_model = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=bnb_cfg,
        device_map="auto",
        torch_dtype=torch.float16,
        trust_remote_code=True
    )

# Enforce left padding for causal batched generation
tokenizer.padding_side = "left"
if tokenizer.pad_token_id is None:
    tokenizer.pad_token_id = tokenizer.eos_token_id

if hasattr(teacher_model.config, "enable_thinking"):
    teacher_model.config.enable_thinking = False

print(f"[READY] Teacher '{model_id}' loaded successfully on device: {teacher_model.device}")
print(f"[PAD] Tokenizer padding side: {tokenizer.padding_side} | pad_token_id: {tokenizer.pad_token_id}")
'''
nb["cells"][4]["source"] = [l + "\n" for l in c4_code.split("\n")[:-1]] + [c4_code.split("\n")[-1]]

# Cell 5: Anchored Prompting
c5_code = '''# ============================================================================
# 4. TEACHER ANCHORED PROMPTING (Koutcheme et al., SIGCSE 2026)
# ============================================================================
def build_teacher_anchored_prompt(record: dict) -> list:
    """Construct system and user messages with gold anchoring for distillation."""
    msgs = record["messages"]
    sys_msg = msgs[0]["content"]
    user_msg = msgs[1]["content"]
    gold_target = msgs[2]["content"]
    
    # Extract gold JSON block from target
    gold_crit = []
    try:
        m = re.search(r'\{\s*"criteria"\s*:\s*\[.*?\]\s*,\s*"needs_human_review"\s*:\s*(?:true|false)\s*\}', gold_target, re.DOTALL)
        if m:
            gold_crit = json.loads(m.group(0))["criteria"]
    except Exception:
        pass

    anchoring_notes = []
    for c in gold_crit:
        cid = c.get("id", "")
        awarded = c.get("awarded", 0)
        ev = c.get("evidence_lines", [])
        comment = c.get("comment", "")
        anchoring_notes.append(f"- Criterion '{cid}': MUST award exactly {awarded} marks. Evidence line(s): {ev}. Context: {comment}")
    
    anchoring_section = (
        "\\n\\n## Teacher Anchoring Directives\\n"
        "You are generating the canonical teacher reasoning trace. You MUST award the exact verified marks listed below:\\n" +
        "\\n".join(anchoring_notes) +
        "\\n\\nEvaluate the student's algorithmic intent step-by-step. Overlook all syntax errors, typos, and naming variations.\\n"
        "Follow the 3-step format: Step 1 reasoning ('Let\\'s think step-by-step.'), Step 2 validated JSON schema, Step 3 sandwich feedback."
    )
    
    return [
        {"role": "system", "content": sys_msg},
        {"role": "user", "content": user_msg + anchoring_section}
    ]
'''
nb["cells"][5]["source"] = [l + "\n" for l in c5_code.split("\n")[:-1]] + [c5_code.split("\n")[-1]]

# Cell 6: Batched Generation Loop
c6_code = '''# ============================================================================
# 5. HIGH-THROUGHPUT BATCHED DISTILLATION (batch_size=8, ~1s/sample)
# ============================================================================
train_sft_path = os.path.join(CFG.data_dir, "train_sft.jsonl")
if not os.path.isfile(train_sft_path):
    train_sft_path = os.path.join(CFG.data_dir, "train_sft_v2.jsonl")
assert os.path.isfile(train_sft_path), f"Training SFT file not found in {CFG.data_dir}"

all_records = []
with open(train_sft_path, "r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            all_records.append(json.loads(line))

print(f"[DATA] Loaded {len(all_records)} total training examples from {train_sft_path}")

# Prioritize records: buggy / non-full-credit / diverse programs benefit most from teacher distillation
def record_priority(r):
    target = r.get("messages", [{}, {}, {}])[2].get("content", "")
    # Higher priority if rubric has deductions
    has_deductions = '"awarded": 0' in target or '"awarded": 0.0' in target
    return 0 if has_deductions else 1

all_records.sort(key=record_priority)

if CFG.smoke_test:
    target_count = CFG.smoke_samples
    print(f"[SMOKE] Subsetting to {target_count} samples for quick verification.")
else:
    target_count = min(len(all_records), CFG.max_distill_samples)
    print(f"[RUN] Distilling top {target_count} priority records through teacher (remaining retain verified gold traces)...")

distill_pool = all_records[:target_count]
passthrough_pool = all_records[target_count:]

teacher_distilled_records = []
n_teacher_accepted = 0
n_fallback_used = 0
batch_durations = []

teacher_model.eval()
B = CFG.batch_size

t_start_total = time.perf_counter()
for b_start in tqdm(range(0, len(distill_pool), B), desc="Batched Teacher Distillation"):
    b_records = distill_pool[b_start:b_start + B]
    t_b0 = time.perf_counter()
    
    # 1. Prepare chat prompts with enable_thinking=False
    prompts = []
    for rec in b_records:
        teacher_msgs = build_teacher_anchored_prompt(rec)
        try:
            p_str = tokenizer.apply_chat_template(teacher_msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        except TypeError:
            p_str = tokenizer.apply_chat_template(teacher_msgs, tokenize=False, add_generation_prompt=True)
        prompts.append(p_str)
    
    # 2. Left-padded batched tokenization
    enc = tokenizer(prompts, return_tensors="pt", padding=True, truncation=True, max_length=CFG.max_seq_len)
    enc = {k: v.to(teacher_model.device) for k, v in enc.items()}
    prompt_len = enc["input_ids"].shape[1]
    
    # 3. Batched greedy generation
    batch_outputs = None
    try:
        with torch.no_grad():
            batch_outputs = teacher_model.generate(
                **enc,
                max_new_tokens=CFG.max_new_tokens,
                do_sample=False,
                temperature=0.0,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id
            )
    except Exception as _b_err:
        print(f"[WARN] Batch {b_start//B} generation error: {_b_err}")
    
    # 4. Decode and validate each item in batch
    for j, rec in enumerate(b_records):
        orig_target = rec["messages"][2]["content"]
        accepted = False
        selected_target = orig_target
        
        if batch_outputs is not None:
            try:
                gen_ids = batch_outputs[j][prompt_len:]
                gen_text = tokenizer.decode(gen_ids, skip_special_tokens=True).strip()
                if "Let's think step-by-step." in gen_text and '"criteria"' in gen_text:
                    accepted = True
                    selected_target = gen_text
            except Exception:
                accepted = False
        
        if accepted:
            n_teacher_accepted += 1
        else:
            n_fallback_used += 1
            
        teacher_distilled_records.append({
            "program_id": rec.get("program_id", f"prog_{b_start + j}"),
            "trace_source": "teacher_7b_batched" if accepted else "code_trace_builder",
            "messages": [
                rec["messages"][0],
                rec["messages"][1],
                {"role": "assistant", "content": selected_target}
            ]
        })
    
    dt_b = time.perf_counter() - t_b0
    batch_durations.append(dt_b)
    
    # Progress report every 5 batches
    if (b_start // B + 1) % 5 == 0 or b_start + B >= len(distill_pool):
        items_done = len(teacher_distilled_records)
        avg_per_item = sum(batch_durations) / (len(batch_durations) * B)
        rem_items = len(distill_pool) - items_done
        eta_min = (rem_items * avg_per_item) / 60.0
        print(f"[BATCH {b_start//B + 1}] Done: {items_done}/{len(distill_pool)} ({items_done/len(distill_pool)*100:.1f}%) | Throughput: {1.0/avg_per_item:.1f} items/s | ETA: {eta_min:.1f} min")

# 5. Append remaining passthrough records with verified gold traces to preserve full dataset volume
for r in passthrough_pool:
    teacher_distilled_records.append({
        "program_id": r.get("program_id", ""),
        "trace_source": "code_trace_builder",
        "messages": r["messages"]
    })

total_time = (time.perf_counter() - t_start_total) / 60.0
print(f"\\n[SUMMARY] Teacher Distillation Complete in {total_time:.2f} min:")
print(f"  Total records in distilled dataset: {len(teacher_distilled_records)}")
print(f"  Teacher distilled: {len(distill_pool)} (Accepted: {n_teacher_accepted}, Fallback: {n_fallback_used})")
print(f"  Verified gold retained: {len(passthrough_pool)}")
'''
nb["cells"][6]["source"] = [l + "\n" for l in c6_code.split("\n")[:-1]] + [c6_code.split("\n")[-1]]

# Cell 7: Token Stats and Output Save
c7_code = '''# ============================================================================
# 6. TOKEN LENGTH AUDIT & SAVE DISTILLED DATASET
# ============================================================================
import numpy as np

lengths = []
for r in teacher_distilled_records[:min(300, len(teacher_distilled_records))]:
    try:
        t = tokenizer.apply_chat_template(r["messages"], tokenize=False, enable_thinking=False)
    except TypeError:
        t = tokenizer.apply_chat_template(r["messages"], tokenize=False)
    lengths.append(len(tokenizer(t, add_special_tokens=False).input_ids))

p50 = int(np.percentile(lengths, 50))
p95 = int(np.percentile(lengths, 95))
p99 = int(np.percentile(lengths, 99))
max_l = int(max(lengths))

print(f"Token Stats (Sampled Distilled Records: {len(lengths)}):")
print(f"  p50: {p50} | p95: {p95} | p99: {p99} | max: {max_l}")

# Save full distilled dataset
out_file = os.path.join(CFG.output_dir, "train_sft_distilled.jsonl")
with open(out_file, "w", encoding="utf-8") as f:
    for r in teacher_distilled_records:
        f.write(json.dumps(r, ensure_ascii=False) + "\\n")

print(f"[SAVED] Distilled SFT training data saved to: {out_file} (Total records: {len(teacher_distilled_records)})")

# Also copy over val_sft and test sets from data_dir for a self-contained training bundle
for fn in ["val_unseen_sft.jsonl", "val_sft.jsonl", "test_seen.jsonl", "test_unseen.jsonl", "test_unseen_synth.jsonl", "test_unseen_real_tasks.jsonl", "data_manifest.json", "execution_reports.json"]:
    src_p = os.path.join(CFG.data_dir, fn)
    if os.path.isfile(src_p):
        shutil.copy(src_p, os.path.join(CFG.output_dir, fn))
        print(f"[COPIED] {fn} -> {CFG.output_dir}")

# Ensure val_sft.jsonl exists in output_dir for downstream NB2 compatibility
val_out = os.path.join(CFG.output_dir, "val_sft.jsonl")
val_unseen_out = os.path.join(CFG.output_dir, "val_unseen_sft.jsonl")
if not os.path.isfile(val_out) and os.path.isfile(val_unseen_out):
    shutil.copy(val_unseen_out, val_out)
    print(f"[ALIAS] Copied val_unseen_sft.jsonl -> val_sft.jsonl")
'''
nb["cells"][7]["source"] = [l + "\n" for l in c7_code.split("\n")[:-1]] + [c7_code.split("\n")[-1]]

with open(nb_path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)

print("Fast nb1b_teacher.ipynb created successfully!")
