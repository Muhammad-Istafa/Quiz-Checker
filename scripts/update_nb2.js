const fs = require('fs');

const nb = JSON.parse(fs.readFileSync('notebooks/nb2_train.ipynb', 'utf8'));

// 1. Update Cell 7 (TrainConfig)
let cell7 = nb.cells[7].source.join('');
cell7 = cell7.replace(
    'max_seq_len:        int   = 2048',
    'max_seq_len:        int   = 2304  # Set from Phase 0 token audit (p99 prompt 894 + response 156 ~ 1050)\n    train_target_format: str   = os.environ.get("TRAIN_TARGET_FORMAT", "reasoning")  # "reasoning" (Arm A2) | "direct" (Arm A1)\n    experiment_arm:      str   = os.environ.get("EXPERIMENT_ARM", "A2")  # "A1" | "A2"'
);
nb.cells[7].source = cell7.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// 2. Update Cell 9 (Verification)
let cell9 = nb.cells[9].source.join('');
cell9 = cell9.replace(
    'for fname in ["train_sft.jsonl", "val_sft.jsonl", "data_manifest.json"]:',
    `# Check available SFT files (v2 or v1.1 fallback)
sft_train_name = "train_sft_v2.jsonl" if getattr(CFG, "train_target_format", "reasoning") == "reasoning" else "train_sft_v2_direct.jsonl"
if not os.path.exists(os.path.join(CFG.data_dir, sft_train_name)):
    sft_train_name = "train_sft.jsonl"

sft_val_name = "val_unseen_sft.jsonl" if os.path.exists(os.path.join(CFG.data_dir, "val_unseen_sft.jsonl")) else "val_sft.jsonl"

for fname in [sft_train_name, sft_val_name, "data_manifest.json"]:`
);
cell9 = cell9.replace(
    'for split_name in ["train", "val", "test_seen", "test_unseen"]:',
    'for split_name in ["train", "val_seen", "val_unseen", "test_seen", "test_unseen_synth", "test_unseen_real_tasks", "val", "test_unseen"]:'
);
nb.cells[9].source = cell9.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// 3. Update Cell 11 & 12 (Dataset selection)
let cell11 = nb.cells[11].source.join('');
cell11 = cell11.replace(
    'with open(os.path.join(CFG.data_dir, "train_sft.jsonl"), encoding="utf-8") as _f:',
    `train_sft_file = os.path.join(CFG.data_dir, sft_train_name)
with open(train_sft_file, encoding="utf-8") as _f:`
);
cell11 = cell11.replace(
    '"train_sft.jsonl system prompt differs from src.prompts.SYSTEM_PROMPT — "',
    'f"{sft_train_name} system prompt differs from src.prompts.SYSTEM_PROMPT — "'
);
nb.cells[11].source = cell11.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// In Cell 13, where datasets are instantiated
let cell13 = nb.cells[13].source.join('');
cell13 = cell13.replace(
    'train_dataset = GraderSFTDataset(os.path.join(CFG.data_dir, "train_sft.jsonl"), tokenizer, CFG)',
    'train_dataset = GraderSFTDataset(os.path.join(CFG.data_dir, sft_train_name), tokenizer, CFG)'
);
cell13 = cell13.replace(
    'val_dataset_full = GraderSFTDataset(os.path.join(CFG.data_dir, "val_sft.jsonl"), tokenizer, CFG)',
    'val_dataset_full = GraderSFTDataset(os.path.join(CFG.data_dir, sft_val_name), tokenizer, CFG)'
);
nb.cells[13].source = cell13.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// 4. Update Cell 20 (GenerationValUnseenCallback)
let cell20 = nb.cells[20].source.join('');
const genCallbackCode = `
class ValUnseenGenerationCallback(TrainerCallback):
    """Evaluates on a fixed 100-sample subset of val_unseen using generated outputs.
    
    Measures marks agreement (exact match and MAE) and parse validity (format compliance),
    saving the best adapter based on generation accuracy rather than loss alone.
    """
    def __init__(self, val_jsonl_path: str, tokenizer, target_path: str, max_samples: int = 100):
        self.val_samples = []
        if os.path.isfile(val_jsonl_path):
            with open(val_jsonl_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        self.val_samples.append(json.loads(line.strip()))
                        if len(self.val_samples) >= max_samples:
                            break
        self.tokenizer = tokenizer
        self.target_path = target_path
        self.best_score = -float("inf")
        self.best_exact_match = 0.0

    def on_evaluate(self, args, state, control, metrics=None, **kwargs):
        if not self.val_samples:
            return
        model = kwargs.get("model")
        if model is None:
            return

        model.eval()
        n_exact = 0
        n_parse_ok = 0
        total_abs_err = 0.0
        n_eval = len(self.val_samples)

        with torch.no_grad():
            for sample in self.val_samples:
                msgs = sample.get("messages", [])[:-1]  # Exclude assistant target
                try:
                    prompt_text = self.tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
                except TypeError:
                    prompt_text = self.tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
                
                inputs = self.tokenizer(prompt_text, return_tensors="pt").to(model.device)
                out_ids = model.generate(
                    **inputs,
                    max_new_tokens=400,
                    do_sample=False,
                    pad_token_id=self.tokenizer.pad_token_id or self.tokenizer.eos_token_id
                )
                gen_text = self.tokenizer.decode(out_ids[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
                
                try:
                    from src.parse import parse_and_validate_output
                    rubric = sample.get("rubric", [])
                    parsed = parse_and_validate_output(gen_text, rubric)
                    if parsed.is_valid:
                        n_parse_ok += 1
                    pred_tot = parsed.total_marks
                except Exception:
                    pred_tot = 0.0

                gold_tot = sample.get("gold_total", 0.0)
                diff = abs(pred_tot - gold_tot)
                total_abs_err += diff
                if diff < 0.01:
                    n_exact += 1

        exact_rate = n_exact / max(1, n_eval)
        parse_rate = n_parse_ok / max(1, n_eval)
        mae = total_abs_err / max(1, n_eval)
        score = exact_rate - (0.1 * mae) + (0.2 * parse_rate)

        print(f"\\n[VAL_UNSEEN EVAL @ Step {state.global_step}] (N={n_eval}):")
        print(f"  • Exact Match:  {exact_rate*100:.1f}% ({n_exact}/{n_eval})")
        print(f"  • Parse Valid:  {parse_rate*100:.1f}% ({n_parse_ok}/{n_eval})")
        print(f"  • MAE:          {mae:.3f}")
        print(f"  • Gen Score:    {score:.4f} (best: {self.best_score:.4f})")

        if score > self.best_score:
            self.best_score = score
            self.best_exact_match = exact_rate
            os.makedirs(self.target_path, exist_ok=True)
            model.save_pretrained(self.target_path)
            if self.tokenizer is not None:
                self.tokenizer.save_pretrained(self.target_path)
            print(f"  → Saved new best adapter to {self.target_path} (exact_match={exact_rate*100:.1f}%)")
        model.train()
`;

cell20 = cell20.replace(
    'class SaveBestAdapterCallback(TrainerCallback):',
    genCallbackCode + '\nclass SaveBestAdapterCallback(TrainerCallback):'
);

cell20 = cell20.replace(
    'callbacks=[\n        TimeBudgetCallback(max_hours=CFG.max_train_hours),\n        SaveBestAdapterCallback(target_path=BEST_ADAPTER_PATH),\n    ],',
    `callbacks=[
        TimeBudgetCallback(max_hours=CFG.max_train_hours),
        ValUnseenGenerationCallback(val_jsonl_path=os.path.join(CFG.data_dir, sft_val_name), tokenizer=tokenizer, target_path=BEST_ADAPTER_PATH, max_samples=100),
        SaveBestAdapterCallback(target_path=BEST_ADAPTER_PATH),
    ],`
);
nb.cells[20].source = cell20.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// 5. Update Cell 22 (Metadata)
let cell22 = nb.cells[22].source.join('');
cell22 = cell22.replace(
    '"actual_model_id":   getattr(CFG, "student_model_id", "Qwen/Qwen3-4B"),',
    `"actual_model_id":   getattr(CFG, "student_model_id", "Qwen/Qwen3-4B"),
    "experiment_arm":    getattr(CFG, "experiment_arm", "A2"),
    "train_target_format": getattr(CFG, "train_target_format", "reasoning"),`
);
nb.cells[22].source = cell22.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

fs.writeFileSync('notebooks/nb2_train.ipynb', JSON.stringify(nb, null, 1), 'utf8');
console.log('Successfully upgraded notebooks/nb2_train.ipynb to Phase 3 v2 specs!');

