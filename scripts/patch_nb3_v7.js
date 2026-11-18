const fs = require('fs');

const nbPath = 'notebooks/nb3_infer.ipynb';
const nb = JSON.parse(fs.readFileSync(nbPath, 'utf8'));

// ---------------------------------------------------------------------------
// 1. PATCH CELL 26: FAST NON-REDUNDANT SPLIT EVALUATION + INSTANT COMPOSITION
// ---------------------------------------------------------------------------
const newCell26 = `# ============================================================================
# 6A. SYSTEM (c): FINE-TUNED Qwen3-4B — main result
# ============================================================================

all_metrics: dict = {}
all_results: dict = {}

if "ft_model" not in globals() or "ft_tok" not in globals():
    logger.info("Loading fine-tuned model …")
    ft_model, ft_tok = load_finetuned_model()
else:
    logger.info("Reusing loaded fine-tuned model …")

# Evaluate atomic benchmark splits without redundant duplicates
eval_split_names = ["val_seen", "val_unseen", "test_seen", "test_unseen_synth", "test_unseen_real_tasks"]

for sn in eval_split_names:
    if sn not in splits or not splits[sn]:
        continue
    recs = splits[sn]
    key = f"FT-4B_{sn}"
    logger.info(f"  {key}: {len(recs)} samples")
    res = run_batch_inference(ft_model, ft_tok, recs, CFG, desc=key)
    all_results[key]  = res
    all_metrics[key]  = compute_metrics(res, key)
    # Paired subset for zero-shot comparisons
    _sub_ids = {r.sample_id for r in ZS_SUBSETS.get(sn, [])}
    if _sub_ids:
        _sub_key = f"FT-4B_{sn}@zs{len(_sub_ids)}"
        all_results[_sub_key] = [x for x in res if x["sample_id"] in _sub_ids]
        all_metrics[_sub_key] = compute_metrics(all_results[_sub_key], _sub_key)

# Compose composite splits instantly from atomic results without redundant GPU passes
if "FT-4B_val_seen" in all_results and "FT-4B_val_unseen" in all_results:
    all_results["FT-4B_val"] = all_results["FT-4B_val_seen"] + all_results["FT-4B_val_unseen"]
    all_metrics["FT-4B_val"] = compute_metrics(all_results["FT-4B_val"], "FT-4B_val")
    logger.info(f"  FT-4B_val (composite): {len(all_results['FT-4B_val'])} samples composed.")

if "FT-4B_test_unseen_synth" in all_results and "FT-4B_test_unseen_real_tasks" in all_results:
    all_results["FT-4B_test_unseen"] = all_results["FT-4B_test_unseen_synth"] + all_results["FT-4B_test_unseen_real_tasks"]
    all_metrics["FT-4B_test_unseen"] = compute_metrics(all_results["FT-4B_test_unseen"], "FT-4B_test_unseen")
    logger.info(f"  FT-4B_test_unseen (composite): {len(all_results['FT-4B_test_unseen'])} samples composed.")

try:
    del ft_model
except Exception:
    pass
gc.collect()
torch.cuda.empty_cache()
`;
nb.cells[26].source = newCell26;

// ---------------------------------------------------------------------------
// 2. PATCH CELL 28: DEFINE EXEC_BASELINE BEFORE CALLING IT
// ---------------------------------------------------------------------------
const newCell28 = `# ============================================================================
# 6C. EXECUTION-ONLY BASELINE (B_exec)
# ============================================================================

def exec_baseline(records: list) -> list:
    """B_exec baseline: returns [] if no test cases are available."""
    out = []
    for rec in records:
        rep = rec.execution_report or {}
        if rep.get("available") is False:
            continue
        ratio = 0.0 if not rep.get("compile_ok") else rep.get("tests_passed", 0) / max(rep.get("tests_total", 1), 1)
        crit = [{"id": c["id"], "awarded": round(c["max_marks"] * ratio * 2) / 2.0,
                 "comment": "execution-only baseline", "evidence_lines": []} for c in rec.rubric]
        out.append({"sample_id": rec.sample_id, "raw_output": "", "raw_parsed": None,
                    "schema_valid_raw": False, "schema_valid_final": True, "needs_human_review": False,
                    "parsed": {"criteria": crit, "total": round(sum(c["awarded"] for c in crit) * 2) / 2.0},
                    "gold_total": rec.gold_total, "gold_criteria": rec.gold_criteria,
                    "max_marks": rec.max_marks, "question_id": rec.question_id, "mutations": [],
                    "is_heavy_ocr": False, "is_garbled": False, "program_id": rec.program_id,
                    "n_answer_lines": len(rec.student_answer.split("\\n"))})
    return out


for sn in ["test_seen", "test_unseen_synth", "test_unseen_real_tasks"]:
    if sn in splits and splits[sn]:
        bx = exec_baseline(splits[sn])
        if bx:
            key = f"B_exec_{sn}"
            all_results[key] = bx
            all_metrics[key] = compute_metrics(bx, key)
`;
nb.cells[28].source = newCell28;

// ---------------------------------------------------------------------------
// 3. PATCH CELL 39: SINGLE-PASS QUIZ 3 INFERENCE (NO REDUNDANT RE-RUNS)
// ---------------------------------------------------------------------------
let c39 = nb.cells[39];
let src39 = Array.isArray(c39.source) ? c39.source.join('') : c39.source;

// Replace the inference loops in Cell 39
const oldInfPattern = /# 1\. Fine-Tuned Model[\s\S]*?del base_mdl; gc\.collect\(\); torch\.cuda\.empty_cache\(\)/;
const newInfBlock = `# 1. Fine-Tuned Model (Our Core Result) on All 46, sliced to Dev and Test
    mdl, tok = load_finetuned_model()
    res_all = run_batch_inference(mdl, tok, real_records_all, CFG, desc="FT-4B_quiz3_all46")
    real_results["FT-4B_quiz3_all46"] = res_all
    real_metrics["FT-4B_quiz3_all46"] = compute_metrics(res_all, "FT-4B_quiz3_all46")

    dev_ids = {r.sample_id for r in dev_records}
    test_ids = {r.sample_id for r in test_records}
    res_dev = [r for r in res_all if r["sample_id"] in dev_ids]
    res_test = [r for r in res_all if r["sample_id"] in test_ids]
    real_results["FT-4B_quiz3_dev"] = res_dev
    real_metrics["FT-4B_quiz3_dev"] = compute_metrics(res_dev, "FT-4B_quiz3_dev")
    real_results["FT-4B_quiz3_test"] = res_test
    real_metrics["FT-4B_quiz3_test"] = compute_metrics(res_test, "FT-4B_quiz3_test")
    del mdl; gc.collect(); torch.cuda.empty_cache()

    # 2. Zero-Shot Base Model on Quiz 3 (Single pass on All 46, sliced to Dev/Test)
    logger.info("Evaluating Zero-Shot Base Model on Quiz 3 dev/test...")
    base_mdl, base_tok = load_base_model(CFG.student_model_id)
    base_res_all = run_batch_inference(base_mdl, base_tok, real_records_all, CFG, desc="ZS_Base_quiz3_all46")
    real_results["ZS_Base_quiz3_all46"] = base_res_all
    real_metrics["ZS_Base_quiz3_all46"] = compute_metrics(base_res_all, "ZS_Base_quiz3_all46")

    real_results["ZS_Base_quiz3_dev"] = [r for r in base_res_all if r["sample_id"] in dev_ids]
    real_metrics["ZS_Base_quiz3_dev"] = compute_metrics(real_results["ZS_Base_quiz3_dev"], "ZS_Base_quiz3_dev")
    real_results["ZS_Base_quiz3_test"] = [r for r in base_res_all if r["sample_id"] in test_ids]
    real_metrics["ZS_Base_quiz3_test"] = compute_metrics(real_results["ZS_Base_quiz3_test"], "ZS_Base_quiz3_test")
    del base_mdl; gc.collect(); torch.cuda.empty_cache()`;

if (oldInfPattern.test(src39)) {
  src39 = src39.replace(oldInfPattern, newInfBlock);
  c39.source = src39;
  console.log('Successfully patched Cell 39 inference flow.');
} else {
  console.log('[WARN] oldInfPattern did not match in Cell 39, leaving as is.');
}

fs.writeFileSync(nbPath, JSON.stringify(nb, null, 1), 'utf8');
console.log('Patched notebooks/nb3_infer.ipynb successfully!');
