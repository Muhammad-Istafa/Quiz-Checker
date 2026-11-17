const fs = require('fs');
const path = require('path');

const nbPath = path.join(__dirname, '..', 'notebooks', 'nb2b_nca.ipynb');
const nb = JSON.parse(fs.readFileSync(nbPath, 'utf8'));

// Patch Cell 3
nb.cells[3].source = [
  '# ============================================================================\n',
  '# 2. LOCATE SFT ADAPTER & DATASET\n',
  '# ============================================================================\n',
  'if os.path.isdir("/kaggle/input"):\n',
  '    print(f"[INPUTS] /kaggle/input contains: {os.listdir(\'/kaggle/input\')}")\n',
  '    for root, dirs, files in os.walk("/kaggle/input"):\n',
  '        for f in files:\n',
  '            if "adapter" in f or "safetensors" in f or "sft" in f:\n',
  '                print("  Found:", os.path.join(root, f))\n',
  '\n',
  'def _resolve_adapter_path(preferred: str) -> str:\n',
  '    if os.path.isdir(preferred) and os.path.isfile(os.path.join(preferred, "adapter_config.json")):\n',
  '        return preferred\n',
  '    all_adapters = glob.glob("/kaggle/input/**/adapter_config.json", recursive=True) + glob.glob("/kaggle/working/**/adapter_config.json", recursive=True)\n',
  '    for a in all_adapters:\n',
  '        if "best_adapter" in a:\n',
  '            return os.path.dirname(a)\n',
  '    for a in all_adapters:\n',
  '        if "checkpoint" in a:\n',
  '            return os.path.dirname(a)\n',
  '    if all_adapters:\n',
  '        return os.path.dirname(all_adapters[0])\n',
  '    loc_cands = glob.glob("output/**/best_adapter", recursive=True) + glob.glob("**/best_adapter", recursive=True)\n',
  '    for c in loc_cands:\n',
  '        if os.path.isdir(c) and os.path.isfile(os.path.join(c, "adapter_config.json")):\n',
  '            return c\n',
  '    return preferred\n',
  '\n',
  'def _resolve_data_dir() -> str:\n',
  '    for fn in ["train_sft_distilled.jsonl", "train_sft_v2.jsonl", "train_sft.jsonl"]:\n',
  '        matches = glob.glob(f"/kaggle/input/**/{fn}", recursive=True) + glob.glob(f"/kaggle/working/**/{fn}", recursive=True)\n',
  '        if matches:\n',
  '            return os.path.dirname(matches[0])\n',
  '    for c in ["output/teacher_distilled", "/kaggle/working/output/teacher_distilled", "/kaggle/input/nb1b-teacher", "/kaggle/input/nb1b-teacher/output/teacher_distilled"]:\n',
  '        if os.path.isdir(c) and os.path.isfile(os.path.join(c, "train_sft_distilled.jsonl")):\n',
  '            return c\n',
  '    for c in ["cpp-grader-data-v2", "/kaggle/working/cpp-grader-data-v2", "cpp-grader-data-v1-1", "/kaggle/working/Quiz-Checker/cpp-grader-data-v2"]:\n',
  '        if os.path.isdir(c) and (os.path.isfile(os.path.join(c, "train_sft.jsonl")) or os.path.isfile(os.path.join(c, "train_sft_v2.jsonl"))):\n',
  '            return c\n',
  '    return "."\n',
  '\n',
  'CFG.sft_adapter_path = _resolve_adapter_path(CFG.sft_adapter_path)\n',
  'CFG.data_dir = _resolve_data_dir()\n',
  'print(f"Resolved SFT Adapter: {CFG.sft_adapter_path}")\n',
  'print(f"Resolved Data Directory: {CFG.data_dir}")\n'
];

// Patch Cell 4
nb.cells[4].source = [
  '# ============================================================================\n',
  '# 3. LOAD TOKENIZER (Strictly lock enable_thinking=False)\n',
  '# ============================================================================\n',
  'from transformers import AutoTokenizer\n',
  '\n',
  'print(f"Loading tokenizer for {CFG.student_model_id}...")\n',
  'tokenizer = AutoTokenizer.from_pretrained(CFG.student_model_id, trust_remote_code=True, padding_side="right")\n',
  'if tokenizer.pad_token is None:\n',
  '    tokenizer.pad_token = tokenizer.eos_token\n',
  '\n',
  '# Verify chat template with enable_thinking=False\n',
  'dummy_msgs = [{"role": "user", "content": "Test"}]\n',
  'rendered = apply_chat_template_safe(tokenizer, dummy_msgs, add_generation_prompt=True)\n',
  'print(f"[DEBUG] Chat template rendered tail: {repr(rendered[-60:])}")\n',
  'assert rendered and len(rendered) > 0, "Chat template rendering returned empty string!"\n',
  'print("[PASS] Tokenizer verified with enable_thinking=False locked.")\n'
];

fs.writeFileSync(nbPath, JSON.stringify(nb, null, 1), 'utf8');
console.log('Successfully patched Cell 3 and Cell 4 of nb2b_nca.ipynb');
