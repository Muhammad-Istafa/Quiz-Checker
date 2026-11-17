const fs = require('fs');
const path = require('path');

const nbPath = path.join(__dirname, '..', 'notebooks', 'nb2b_nca.ipynb');
const nb = JSON.parse(fs.readFileSync(nbPath, 'utf8'));

// Patch Cell 3 (Index 3)
nb.cells[3].source = [
  "# ============================================================================\n",
  "# 2. LOCATE SFT ADAPTER & DATASET\n",
  "# ============================================================================\n",
  "def _resolve_adapter_path(preferred: str) -> str:\n",
  "    if os.path.isdir(preferred) and os.path.isfile(os.path.join(preferred, \"adapter_config.json\")):\n",
  "        return preferred\n",
  "    # Search /kaggle/input and /kaggle/working recursively\n",
  "    all_adapters = glob.glob(\"/kaggle/input/**/adapter_config.json\", recursive=True) + glob.glob(\"/kaggle/working/**/adapter_config.json\", recursive=True)\n",
  "    for a in all_adapters:\n",
  "        if \"best_adapter\" in a:\n",
  "            return os.path.dirname(a)\n",
  "    for a in all_adapters:\n",
  "        if \"checkpoint-166\" in a or \"checkpoint\" in a:\n",
  "            return os.path.dirname(a)\n",
  "    if all_adapters:\n",
  "        return os.path.dirname(all_adapters[0])\n",
  "    # Local fallback search\n",
  "    loc_cands = glob.glob(\"output/**/best_adapter\", recursive=True) + glob.glob(\"**/best_adapter\", recursive=True)\n",
  "    for c in loc_cands:\n",
  "        if os.path.isdir(c) and os.path.isfile(os.path.join(c, \"adapter_config.json\")):\n",
  "            return c\n",
  "    return preferred\n",
  "\n",
  "def _resolve_data_dir() -> str:\n",
  "    # 1. Search /kaggle/input and /kaggle/working recursively\n",
  "    for fn in [\"train_sft_distilled.jsonl\", \"train_sft_v2.jsonl\", \"train_sft.jsonl\"]:\n",
  "        matches = glob.glob(f\"/kaggle/input/**/{fn}\", recursive=True) + glob.glob(f\"/kaggle/working/**/{fn}\", recursive=True)\n",
  "        if matches:\n",
  "            return os.path.dirname(matches[0])\n",
  "    # 2. Check teacher distilled outputs first\n",
  "    for c in [\"output/teacher_distilled\", \"/kaggle/working/output/teacher_distilled\", \"/kaggle/input/nb1b-teacher\", \"/kaggle/input/nb1b-teacher/output/teacher_distilled\"]:\n",
  "        if os.path.isdir(c) and os.path.isfile(os.path.join(c, \"train_sft_distilled.jsonl\")):\n",
  "            return c\n",
  "    # 3. Check standard dataset locations\n",
  "    for c in [\"cpp-grader-data-v2\", \"/kaggle/working/cpp-grader-data-v2\", \"cpp-grader-data-v1-1\", \"/kaggle/working/Quiz-Checker/cpp-grader-data-v2\"]:\n",
  "        if os.path.isdir(c) and (os.path.isfile(os.path.join(c, \"train_sft.jsonl\")) or os.path.isfile(os.path.join(c, \"train_sft_v2.jsonl\"))):\n",
  "            return c\n",
  "    return \".\"\n",
  "\n",
  "CFG.sft_adapter_path = _resolve_adapter_path(CFG.sft_adapter_path)\n",
  "CFG.data_dir = _resolve_data_dir()\n",
  "print(f\"Resolved SFT Adapter: {CFG.sft_adapter_path}\")\n",
  "print(f\"Resolved Data Directory: {CFG.data_dir}\")\n"
];

// Patch Cell 6 (Index 6)
let c6 = nb.cells[6].source.join('');
if (!c6.includes('glob.glob(f"/kaggle/input/**/{fn}"')) {
  c6 = c6.replace(
    'loaded_file = None',
    'for fn in ["train_sft_distilled.jsonl", "train_sft_v2.jsonl", "train_sft.jsonl"]:\n    target_candidates.extend(glob.glob(f"/kaggle/input/**/{fn}", recursive=True))\n    target_candidates.extend(glob.glob(f"/kaggle/working/**/{fn}", recursive=True))\nloaded_file = None'
  );
}

const safeguardStr = '\nif not preference_triples and raw_records:\n    print("[WARN] No natural disagreements found with delta >= 0.5; building margin-based pairs...")\n    for rec in mining_targets[:min(len(mining_targets), 50)]:\n        msgs = rec.get("messages", [])\n        if len(msgs) >= 3:\n            p_text = apply_chat_template_safe(tokenizer, msgs[:2], add_generation_prompt=True)\n            chosen = msgs[2]["content"]\n            rejected = "Let\'s think step-by-step. The student solution appears incorrect on basic syntax. {\\"criteria\\": [{\\"id\\": \\"crit_0\\", \\\"marks_awarded\\": 0.0, \\\"comment\\\": \\\"Failed execution.\\\"}]}"\n            preference_triples.append({"prompt": p_text, "chosen": chosen, "rejected": rejected})\n    print(f"[FALLBACK] Created {len(preference_triples)} margin preference pairs.")\n';

if (!c6.includes('No natural disagreements found')) {
  c6 = c6.replace('print(f"[MINING COMPLETE] Successfully assembled', safeguardStr + '\nprint(f"[MINING COMPLETE] Successfully assembled');
}

nb.cells[6].source = c6.split('\n').map((line, idx, arr) => idx < arr.length - 1 ? line + '\n' : line);

fs.writeFileSync(nbPath, JSON.stringify(nb, null, 1), 'utf8');
console.log('Successfully patched notebooks/nb2b_nca.ipynb');
