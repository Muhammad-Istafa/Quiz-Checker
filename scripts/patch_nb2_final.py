import json

nb_path = "notebooks/nb2_train.ipynb"
with open(nb_path, "r", encoding="utf-8") as f:
    nb = json.load(f)

# Cell 16: Build Datasets & Evaluation Subset
nb["cells"][16]["source"] = [
    "# ============================================================================\n",
    "# 3B. BUILD DATASETS & EVALUATION SUBSET\n",
    "# ============================================================================\n",
    "\n",
    "train_dataset = GraderSFTDataset(\n",
    "    os.path.join(CFG.data_dir, sft_train_name), tokenizer, CFG\n",
    ")\n",
    "val_dataset_full = GraderSFTDataset(\n",
    "    os.path.join(CFG.data_dir, sft_val_name),   tokenizer, CFG\n",
    ")\n",
    "\n",
    "assert len(train_dataset) > 0, \"Training dataset is empty after tokenisation.\"\n",
    "assert len(val_dataset_full) > 0, \"Validation dataset is empty.\"\n",
    "\n",
    "# Outlier drop check: allow dropping extreme outlier submissions (>2048 tokens) while requiring high retention\n",
    "assert len(train_dataset) >= 2000, f\"Expected at least 2000 training examples, got {len(train_dataset)}!\"\n",
    "assert len(val_dataset_full) >= 250, f\"Expected at least 250 validation examples, got {len(val_dataset_full)}!\"\n",
    "\n",
    "drop_rate = train_dataset._dropped / max(len(train_dataset) + train_dataset._dropped, 1)\n",
    "print(f\"\\n[PASS] Train: {len(train_dataset)} examples kept, {train_dataset._dropped} outliers dropped ({drop_rate:.1%})\")\n",
    "print(f\"[PASS] Val:   {len(val_dataset_full)} examples kept, {val_dataset_full._dropped} outliers dropped\")\n",
    "\n",
    "# Subset validation dataset for training evaluations to keep evaluation fast\n",
    "if len(val_dataset_full) > CFG.val_subset_size:\n",
    "    rng = np.random.RandomState(CFG.seed)\n",
    "    sub_indices = rng.choice(len(val_dataset_full), size=CFG.val_subset_size, replace=False)\n",
    "    sub_indices.sort()\n",
    "    eval_dataset = torch.utils.data.Subset(val_dataset_full, sub_indices)\n",
    "    print(f\"Val subset for training evaluations: {len(eval_dataset)} examples (out of {len(val_dataset_full)})\")\n",
    "else:\n",
    "    eval_dataset = val_dataset_full\n",
    "\n",
    "collator = PaddingCollator(pad_id=tokenizer.pad_token_id or tokenizer.eos_token_id)\n",
    "\n",
    "_s = train_dataset[0]\n",
    "_n_resp = (_s[\"labels\"] != -100).sum().item()\n",
    "print(f\"Sample: input_ids={_s['input_ids'].shape}  non-masked labels={_n_resp}\")\n",
    "assert _n_resp > 0, \"No non-masked label tokens — completion-only masking failed.\"\n"
]

# Cell 20: Keep the fast eval_dataset from Cell 16
cell20_lines = nb["cells"][20]["source"]
new_cell20_lines = []
for line in cell20_lines:
    if "eval_dataset = val_dataset_full if not SMOKE_TEST else" in line:
        new_cell20_lines.append("# Keep eval_dataset as configured in Cell 16 (subset of 60 for fast evaluation)\n")
        new_cell20_lines.append("if 'eval_dataset' not in globals() or eval_dataset is None:\n")
        new_cell20_lines.append("    eval_dataset = val_dataset_full if not SMOKE_TEST else torch.utils.data.Subset(val_dataset_full, range(min(20, len(val_dataset_full))))\n")
    else:
        new_cell20_lines.append(line)
nb["cells"][20]["source"] = new_cell20_lines

with open(nb_path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=2)

print("Successfully updated notebooks/nb2_train.ipynb!")
