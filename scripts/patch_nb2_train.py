import json
import os

nb_path = "notebooks/nb2_train.ipynb"
with open(nb_path, "r", encoding="utf-8") as f:
    nb = json.load(f)

# 1. Cell 3: Ensure 'trl' is in _REQUIRED
c3 = "".join(nb["cells"][3]["source"])
if '"trl"' not in c3:
    c3 = c3.replace(
        '_REQUIRED = ["bitsandbytes", "peft", "accelerate"]',
        '_REQUIRED = ["bitsandbytes", "peft", "accelerate", "trl"]'
    )
    nb["cells"][3]["source"] = [l + "\n" for l in c3.split("\n")[:-1]] + [c3.split("\n")[-1]]

# 2. Cell 6: Extract dataset zip if found in clone
c6 = "".join(nb["cells"][6]["source"])
extract_snippet = '''
            # Extract dataset bundle if cloned
            cloned_zip = os.path.join(repo_dest, "cpp-grader-data-v2.zip")
            if os.path.isfile(cloned_zip) and not os.path.isdir("/kaggle/working/cpp-grader-data-v2"):
                print(f"[SETUP] Extracting dataset bundle from {cloned_zip}...")
                import zipfile
                try:
                    with zipfile.ZipFile(cloned_zip, "r") as z:
                        z.extractall("/kaggle/working")
                    print("[SETUP] Extracted cpp-grader-data-v2 from git clone!")
                except Exception as _ze:
                    print(f"[WARN] Failed extracting {cloned_zip}: {_ze}")
'''
if "cloned_zip" not in c6 and "repo_dest" in c6:
    c6 = c6.replace(
        'return pkg_dir\n        except Exception as _clone_err:',
        extract_snippet + '            return pkg_dir\n        except Exception as _clone_err:'
    )
    nb["cells"][6]["source"] = [l + "\n" for l in c6.split("\n")[:-1]] + [c6.split("\n")[-1]]

# 3. Cell 7: Add max_training_hours alias in TrainConfig
c7 = "".join(nb["cells"][7]["source"])
if "max_training_hours" not in c7:
    c7 = c7.replace(
        'max_train_hours:              float = 7.5   # Clean stop limit before Kaggle timeout',
        'max_train_hours:              float = 7.5   # Clean stop limit before Kaggle timeout\n    max_training_hours:           float = 7.5   # Alias for TimeBudgetCallback'
    )
    nb["cells"][7]["source"] = [l + "\n" for l in c7.split("\n")[:-1]] + [c7.split("\n")[-1]]

# 4. Cell 9: Robust sft file detection (support teacher distilled, v2, and v1.1)
c9 = "".join(nb["cells"][9]["source"])
c9_new = '''# ============================================================================
# 1. VERIFY NB1 DATA, SCHEMA, DISJOINT SPLITS & MEASURE MAX_SEQ_LEN
# ============================================================================

# Priority: Teacher Distilled SFT -> Arm A2 (Reasoning) -> Arm A1 (Direct) -> train_sft.jsonl
if os.path.exists(os.path.join(CFG.data_dir, "train_sft_distilled.jsonl")):
    sft_train_name = "train_sft_distilled.jsonl"
elif getattr(CFG, "train_target_format", "reasoning") == "reasoning":
    sft_train_name = "train_sft_v2.jsonl" if os.path.exists(os.path.join(CFG.data_dir, "train_sft_v2.jsonl")) else "train_sft.jsonl"
else:
    sft_train_name = "train_sft_v2_direct.jsonl" if os.path.exists(os.path.join(CFG.data_dir, "train_sft_v2_direct.jsonl")) else "train_sft.jsonl"

sft_val_name = "val_sft.jsonl" if os.path.exists(os.path.join(CFG.data_dir, "val_sft.jsonl")) else "val_unseen_sft.jsonl"

print(f"Selected training SFT dataset:   {sft_train_name}")
print(f"Selected validation SFT dataset: {sft_val_name}")

for fname in [sft_train_name, sft_val_name, "data_manifest.json"]:
    fpath = os.path.join(CFG.data_dir, fname)
    assert os.path.exists(fpath), f"Missing {fpath} — run NB1 (nb1_data.py) first."

# Check schema version matches
with open(os.path.join(CFG.data_dir, "data_manifest.json")) as f:
    _manifest = json.load(f)
assert _manifest.get("schema_version") == SCHEMA_VERSION, (
    f"Schema version mismatch: manifest has {_manifest.get('schema_version')}, "
    f"expected {SCHEMA_VERSION}."
)
print(f"[PASS] Schema version matches: {SCHEMA_VERSION}")
'''
# Replace top part of Cell 9
c9_parts = c9.split('# Check schema version matches')
if len(c9_parts) == 2:
    c9_rest = '# Check schema version matches' + c9_parts[1]
    c9_updated = c9_new.split('# Check schema version matches')[0] + c9_rest
    nb["cells"][9]["source"] = [l + "\n" for l in c9_updated.split("\n")[:-1]] + [c9_updated.split("\n")[-1]]

# 5. Cell 16: Use resolved sft_train_name and sft_val_name
c16 = "".join(nb["cells"][16]["source"])
c16_target = 'train_dataset = GraderSFTDataset(\n    os.path.join(CFG.data_dir, "train_sft.jsonl"), tokenizer, CFG\n)\nval_dataset_full = GraderSFTDataset(\n    os.path.join(CFG.data_dir, "val_sft.jsonl"),   tokenizer, CFG\n)'
c16_replacement = 'train_dataset = GraderSFTDataset(\n    os.path.join(CFG.data_dir, sft_train_name), tokenizer, CFG\n)\nval_dataset_full = GraderSFTDataset(\n    os.path.join(CFG.data_dir, sft_val_name),   tokenizer, CFG\n)'
if c16_target in c16:
    c16 = c16.replace(c16_target, c16_replacement)
    nb["cells"][16]["source"] = [l + "\n" for l in c16.split("\n")[:-1]] + [c16.split("\n")[-1]]

# 6. Cell 20: Safe access to max_train_hours
c20 = "".join(nb["cells"][20]["source"])
if "CFG.max_training_hours" in c20:
    c20 = c20.replace(
        "TimeBudgetCallback(max_hours=CFG.max_training_hours)",
        "TimeBudgetCallback(max_hours=getattr(CFG, 'max_train_hours', getattr(CFG, 'max_training_hours', 7.5)))"
    )
    nb["cells"][20]["source"] = [l + "\n" for l in c20.split("\n")[:-1]] + [c20.split("\n")[-1]]

with open(nb_path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)

print("nb2_train.ipynb patched successfully!")
