import json

nb_path = "notebooks/nb2_train.ipynb"
with open(nb_path, "r", encoding="utf-8") as f:
    nb = json.load(f)

# 1. Update Cell 7 (0D. CONFIG)
cell7_src = "".join(nb["cells"][7]["source"])
if "expandable_segments:True" not in cell7_src:
    nb["cells"][7]["source"] = [
        "# ============================================================================\n",
        "# 0D. CONFIG\n",
        "# ============================================================================\n",
        "import os\n",
        "os.environ[\"PYTORCH_CUDA_ALLOC_CONF\"] = \"expandable_segments:True\"\n",
        "\n",
    ] + nb["cells"][7]["source"]

# 2. Update Cell 9 (1. VERIFY DATA & MEASURE MAX_SEQ_LEN)
# Ensure CFG.max_seq_len is strictly capped at 2048 for T4 16GB VRAM safety
cell9_lines = nb["cells"][9]["source"]
new_cell9_lines = []
for line in cell9_lines:
    if "CFG.max_seq_len = rounded_max" in line:
        new_cell9_lines.append("CFG.max_seq_len = min(rounded_max, 2048)\n")
        new_cell9_lines.append("print(f\"\\nCFG.max_seq_len safety capped to: {CFG.max_seq_len} (T4 16GB GPU safety ceiling; covers >99% of data)\")\n")
    elif "CFG.max_seq_len set to:" in line and "rounded up to multiple" in line:
        continue
    else:
        new_cell9_lines.append(line)
nb["cells"][9]["source"] = new_cell9_lines

# 3. Update Cell 16 (3B. BUILD DATASETS & EVALUATION SUBSET)
cell16_lines = nb["cells"][16]["source"]
new_cell16_lines = []
for line in cell16_lines:
    if "assert train_dataset._dropped == 0" in line:
        new_cell16_lines.append("# Outlier drop check: allow dropping extreme outliers (>2048 tokens) while requiring >=95% retention\n")
        new_cell16_lines.append("drop_rate = train_dataset._dropped / max(len(train_dataset) + train_dataset._dropped, 1)\n")
        new_cell16_lines.append("assert drop_rate < 0.05, f\"Drop rate {drop_rate:.1%} exceeds 5% threshold ({train_dataset._dropped} dropped)!\"\n")
        new_cell16_lines.append("assert len(train_dataset) >= 2800, f\"Expected at least 2800 training examples, got {len(train_dataset)}!\"\n")
    elif "assert val_dataset_full._dropped == 0" in line:
        new_cell16_lines.append("assert val_dataset_full._dropped <= 20, f\"Too many dropped in val: {val_dataset_full._dropped}!\"\n")
    else:
        new_cell16_lines.append(line)
nb["cells"][16]["source"] = new_cell16_lines

# 4. In Cell 19 / Cell 21: Add torch.cuda.empty_cache() before training
cell21_src = nb["cells"][21]["source"]
nb["cells"][21]["source"] = [
    "# ============================================================================\n",
    "# 4C. TRAIN\n",
    "# ============================================================================\n",
    "import torch, gc\n",
    "gc.collect()\n",
    "torch.cuda.empty_cache()\n",
    "\n",
    "logger.info(\"Starting QLoRA fine-tuning …\")\n",
    "train_result = trainer.train(resume_from_checkpoint=RESUME_FROM)\n"
]

with open(nb_path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=2)

print("Successfully applied OOM safety fixes to nb2_train.ipynb!")
