import json
import os

nb_path = "notebooks/nb1b_teacher.ipynb"
with open(nb_path, "r", encoding="utf-8") as f:
    nb = json.load(f)

# Cell 1: ensure tqdm is imported
c1 = "".join(nb["cells"][1]["source"])
if "from tqdm.auto import tqdm" not in c1:
    c1 = c1.replace(
        "import os, sys, glob, shutil, json, gc, time, re",
        "import os, sys, glob, shutil, json, gc, time, re\nfrom tqdm.auto import tqdm"
    )
    nb["cells"][1]["source"] = [line + "\n" for line in c1.split("\n")[:-1]] + [c1.split("\n")[-1]]

# Cell 3: robust resolve_data_dir
c3_new = '''# ============================================================================
# 2. LOCATE DATASET V2
# ============================================================================
def _resolve_data_dir() -> str:
    # 1. Check DATA_DIR environment variable
    env = os.environ.get("DATA_DIR", "")
    if env and (os.path.isfile(os.path.join(env, "train_sft.jsonl")) or os.path.isfile(os.path.join(env, "train_sft_v2.jsonl"))):
        return env

    # 2. Check local directories
    cands = [
        "/kaggle/working/cpp-grader-data-v2",
        "cpp-grader-data-v2",
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
    matches = [p for p in matches if os.path.isfile(p)]
    if matches:
        return os.path.dirname(matches[0])

    raise FileNotFoundError("Cannot find train_sft.jsonl or train_sft_v2.jsonl. Run NB1 (nb1_data.py) first or attach its output dataset.")

CFG.data_dir = _resolve_data_dir()
print(f"[DATA] Using input dataset from: {CFG.data_dir}")
os.makedirs(CFG.output_dir, exist_ok=True)
'''
nb["cells"][3]["source"] = [line + "\n" for line in c3_new.split("\n")[:-1]] + [c3_new.split("\n")[-1]]

# Cell 6: check train_sft_v2.jsonl fallback
c6 = "".join(nb["cells"][6]["source"])
c6_target = 'train_sft_path = os.path.join(CFG.data_dir, "train_sft.jsonl")'
c6_replacement = '''train_sft_path = os.path.join(CFG.data_dir, "train_sft.jsonl")
if not os.path.isfile(train_sft_path):
    train_sft_path = os.path.join(CFG.data_dir, "train_sft_v2.jsonl")
assert os.path.isfile(train_sft_path), f"Training SFT file not found in {CFG.data_dir}"'''
if c6_target in c6 and "if not os.path.isfile(train_sft_path)" not in c6:
    c6 = c6.replace(c6_target, c6_replacement)
    nb["cells"][6]["source"] = [line + "\n" for line in c6.split("\n")[:-1]] + [c6.split("\n")[-1]]

# Cell 7: copy all required files and alias val_sft.jsonl
c7_new = '''# ============================================================================
# 6. TOKEN LENGTH AUDIT & SAVE DISTILLED DATASET
# ============================================================================
import numpy as np

lengths = []
for r in teacher_distilled_records:
    try:
        t = tokenizer.apply_chat_template(r["messages"], tokenize=False, enable_thinking=False)
    except TypeError:
        t = tokenizer.apply_chat_template(r["messages"], tokenize=False)
    lengths.append(len(tokenizer(t, add_special_tokens=False).input_ids))

p50 = int(np.percentile(lengths, 50))
p95 = int(np.percentile(lengths, 95))
p99 = int(np.percentile(lengths, 99))
max_l = int(max(lengths))
n_truncated = sum(1 for l in lengths if l > CFG.max_seq_len)

print(f"Token Stats (Total Distilled Records: {len(lengths)}):")
print(f"  p50: {p50} | p95: {p95} | p99: {p99} | max: {max_l}")
print(f"  Budget: {CFG.max_seq_len} | Truncated: {n_truncated} ({n_truncated/len(lengths)*100:.2f}%)")

# Save distilled dataset
out_file = os.path.join(CFG.output_dir, "train_sft_distilled.jsonl")
with open(out_file, "w", encoding="utf-8") as f:
    for r in teacher_distilled_records:
        f.write(json.dumps(r, ensure_ascii=False) + "\\n")

print(f"[SAVED] Distilled SFT training data saved to: {out_file}")

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
nb["cells"][7]["source"] = [line + "\n" for line in c7_new.split("\n")[:-1]] + [c7_new.split("\n")[-1]]

with open(nb_path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)

print("Updated notebooks/nb1b_teacher.ipynb successfully!")
