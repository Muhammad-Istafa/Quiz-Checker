const fs = require('fs');

const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

// 1. Update Cell 6 (resolve_data_dir to include v2)
let cell6 = nb.cells[6].source.join('');
cell6 = cell6.replace(
    'if "SCHEMA_VERSION" not in globals():\n    SCHEMA_VERSION = "v3.1"',
    `if "SCHEMA_VERSION" not in globals():
    SCHEMA_VERSION = "v3.1"

# Shared code import
try:
    from src.paths import resolve_data_dir, nb1_output_dir
except Exception:
    pass`
);
cell6 = cell6.replace(
    'v1_1 = [d for d in complete if "data_v1_1" in d]\n        return v1_1[0] if v1_1 else complete[0]',
    'v2_cand = [d for d in complete if "data-v2" in d or "data_v2" in d]\n        if v2_cand: return v2_cand[0]\n        v1_1 = [d for d in complete if "data_v1_1" in d or "data-v1-1" in d]\n        return v1_1[0] if v1_1 else complete[0]'
);
nb.cells[6].source = cell6.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// 2. Update Cell 9 (Load v2 splits)
let cell9 = nb.cells[9].source.join('');
cell9 = cell9.replace(
    'for sn in ["val", "test_seen", "test_unseen"]:',
    `# Load v2 splits with fallback to v1.1
all_target_splits = ["train", "val_seen", "val_unseen", "test_seen", "test_unseen_synth", "test_unseen_real_tasks", "val", "test_unseen"]
for sn in all_target_splits:`
);
nb.cells[9].source = cell9.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// 3. Update Cell 16 (Deterministic parser integration)
let cell16 = nb.cells[16].source.join('');
const parserIntegrationCode = `
# Deterministic 3-step parser integration from src.parse
try:
    from src.parse import parse_and_validate_output as _parse_v2
except Exception:
    _parse_v2 = None
`;
cell16 = cell16.replace(
    '# Extract JSON\n    clean = raw_json.strip()',
    `${parserIntegrationCode}
    # Parse with strict deterministic parser if available
    reasoning_text = ""
    feedback_text = ""
    if _parse_v2 is not None:
        p_res = _parse_v2(raw_json, rubric, student_answer)
        reasoning_text = p_res.reasoning
        feedback_text = p_res.feedback
        result["reasoning"] = reasoning_text
        result["feedback"] = feedback_text
        result["failure_types"] = p_res.failure_types
        if p_res.is_valid:
            result["schema_valid_raw"] = True
            result["schema_valid_final"] = True
            result["parsed"] = {
                "criteria": p_res.criteria,
                "total": p_res.total_marks,
                "needs_human_review": p_res.needs_human_review,
            }
            result["needs_human_review"] = p_res.needs_human_review
            return result

    # Fallback extraction
    clean = raw_json.strip()`
);
nb.cells[16].source = cell16.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// 4. Update Cell 20 (Per-criterion bug fix + Comprehensive Phase 4 Metrics)
let cell20 = nb.cells[20].source.join('');
// Fix per-criterion bug
cell20 = cell20.replace(
    'M["final_per_criterion_accuracy"] = ok / max(tot, 1)',
    `if tot > 0:
        M["final_per_criterion_accuracy"] = ok / tot
        M["final_per_criterion_accuracy_ci"] = _bootstrap_ci(graded, "criterion")
    else:
        M["final_per_criterion_accuracy"] = float("nan")
        M["final_per_criterion_accuracy_ci"] = "n/a"`
);
cell20 = cell20.replace(
    'M["final_per_criterion_accuracy_ci"] = _bootstrap_ci(graded, "criterion")',
    '# Per-criterion CI handled in guarded branch above'
);

// Add Phase 4 metrics to compute_metrics
const additionalMetrics = `
    # ── Phase 4 Advanced Metrics ──────────────────────────────────────────────
    if gold and pred:
        # Signed error and Leniency (Pathak et al. / Diaconu et al.)
        signed_errors = [p - g for g, p in zip(gold, pred)]
        M["signed_error"] = float(np.mean(signed_errors))
        
        # Normalised by max_marks
        max_marks_list = [r.get("max_marks", 10.0) or 10.0 for r in graded]
        norm_signed = [(p - g) / max(m, 0.1) for g, p, m in zip(gold, pred, max_marks_list)]
        M["leniency"] = float(np.mean(norm_signed))
        M["mae_normalized"] = float(M["final_mae"] / max(np.mean(max_marks_list), 0.1))

        # Tolerance bands: ±3.3% and ±10% of max marks (Diaconu et al.)
        tol_3_3 = [abs(p - g) <= 0.033 * m for g, p, m in zip(gold, pred, max_marks_list)]
        tol_10 = [abs(p - g) <= 0.10 * m for g, p, m in zip(gold, pred, max_marks_list)]
        M["within_3_3_pct"] = sum(tol_3_3) / len(gold)
        M["within_10_pct"] = sum(tol_10) / len(gold)

        # Correlation metrics
        from scipy.stats import pearsonr, spearmanr, kendalltau
        try:
            if len(gold) >= 3 and len(set(gold)) > 1 and len(set(pred)) > 1:
                M["pearson_r"] = float(pearsonr(gold, pred)[0])
                M["spearman_rho"] = float(spearmanr(gold, pred)[0])
                M["kendall_tau"] = float(kendalltau(gold, pred)[0])
            else:
                M["pearson_r"] = float("nan")
                M["spearman_rho"] = float("nan")
                M["kendall_tau"] = float("nan")
        except Exception:
            M["pearson_r"] = float("nan")
            M["spearman_rho"] = float("nan")
            M["kendall_tau"] = float("nan")

        # False-penalty & false-credit rates
        full_gt = [r for r in graded if r["gold_total"] >= r.get("max_marks", 10.0) - 0.01]
        zero_gt = [r for r in graded if r["gold_total"] <= 0.5]
        M["false_penalty_rate"] = sum(1 for r in full_gt if _final_pred(r) < r["gold_total"] - 0.01) / max(len(full_gt), 1)
        M["false_credit_rate"] = sum(1 for r in zero_gt if _final_pred(r) > 1.0) / max(len(zero_gt), 1)

        # Degeneracy check: prediction variance per question
        q_preds = defaultdict(list)
        for r in graded:
            q_preds[r.get("question_id", "default")].append(_final_pred(r))
        q_vars = {qid: float(np.var(p_list)) for qid, p_list in q_preds.items() if len(p_list) > 1}
        M["min_question_pred_var"] = min(q_vars.values()) if q_vars else float("nan")
        M["is_degenerate"] = any(v < 1e-4 for v in q_vars.values()) if q_vars else False
`;
cell20 = cell20.replace(
    'return M',
    `${additionalMetrics}\n    return M`
);
nb.cells[20].source = cell20.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// 5. Update Cell 27 and 28 (Retire ZS-4B and ZS-8B from synthetic test loops)
nb.cells[27].source = [
    '# ============================================================================\n',
    '# 6B. BASELINES (Phase 4: Retired ZS-4B / ZS-8B from synthetic loops to save compute)\n',
    '# ============================================================================\n',
    'logger.info("Synthetic zero-shot 4B/8B loops retired per Phase 4 protocol (evaluating zero-shot base on Quiz 3 only).")\n'
];
nb.cells[28].source = [
    '# ============================================================================\n',
    '# 6C. EXECUTION-ONLY BASELINE (B_exec)\n',
    '# ============================================================================\n',
    'for sn in ["test_seen", "test_unseen_synth", "test_unseen_real_tasks"]:\n',
    '    if sn in splits and splits[sn]:\n',
    '        bx = exec_baseline(splits[sn])\n',
    '        if bx:\n',
    '            key = f"B_exec_{sn}"\n',
    '            all_results[key] = bx\n',
    '            all_metrics[key] = compute_metrics(bx, key)\n'
];

// 6. Update Cell 38 and 39 (Quiz 3 Real Data Upgrade: Dev/Test splits, raw vs clean, error analysis dump)
let cell39 = nb.cells[39].source.join('');
const quiz3UpgradeCode = `
# ============================================================================
# 8B. REAL EVALUATION (FAST NUCES Quiz 3 — Dev & Test Splits, Raw vs Clean)
# ============================================================================

real_data_target = _resolve_real_data_path()

if os.path.exists(real_data_target):
    logger.info(f"Executing Real Holdout Evaluation on: {real_data_target}")
    real_records_all = load_real_data(real_data_target)
    real_dir = os.path.join(CFG.output_dir, "real")
    os.makedirs(os.path.join(real_dir, "predictions"), exist_ok=True)
    real_results, real_metrics = {}, {}

    # Load frozen split if available
    split_file = "quiz3_split.json"
    quiz3_dev_ids, quiz3_test_ids = set(), set()
    if os.path.isfile(split_file):
        with open(split_file, "r") as f:
            q3_split = json.load(f)
            quiz3_dev_ids = {s["roll_no"] for s in q3_split.get("dev", [])}
            quiz3_test_ids = {s["roll_no"] for s in q3_split.get("test", [])}
        logger.info(f"Loaded frozen Quiz 3 split: {len(quiz3_dev_ids)} dev, {len(quiz3_test_ids)} test students.")

    dev_records = [r for r in real_records_all if r.sample_id in quiz3_dev_ids] or real_records_all[:23]
    test_records = [r for r in real_records_all if r.sample_id in quiz3_test_ids] or real_records_all[23:]

    # 1. Fine-Tuned Model (Our Core Result) on All 46, Dev, and Test
    mdl, tok = load_finetuned_model()
    for name, recs in [("FT-4B_quiz3_all46", real_records_all), ("FT-4B_quiz3_dev", dev_records), ("FT-4B_quiz3_test", test_records)]:
        res = run_batch_inference(mdl, tok, recs, CFG, desc=name)
        real_results[name] = res
        real_metrics[name] = compute_metrics(res, name)

    # 2. Zero-Shot Base Model on Quiz 3 (Cheap single base run per Phase 4)
    logger.info("Evaluating Zero-Shot Base Model on Quiz 3 dev/test...")
    base_mdl, base_tok = load_base_model(CFG.student_model_id)
    for name, recs in [("ZS_Base_quiz3_all46", real_records_all), ("ZS_Base_quiz3_dev", dev_records), ("ZS_Base_quiz3_test", test_records)]:
        res = run_batch_inference(base_mdl, base_tok, recs, CFG, desc=name)
        real_results[name] = res
        real_metrics[name] = compute_metrics(res, name)
    del base_mdl; gc.collect(); torch.cuda.empty_cache()

    # 3. Execution Baseline
    _bx = exec_baseline(real_records_all)
    if _bx:
        real_results["B_exec_quiz3"] = _bx
        real_metrics["B_exec_quiz3"] = compute_metrics(_bx, "B_exec_quiz3")

    # 4. Error Analysis Dump on Dev (Disagreements >= 10% of max marks)
    dev_res = real_results.get("FT-4B_quiz3_dev", [])
    dev_dump = []
    for r in dev_res:
        gold = r.get("gold_total", 0.0)
        pred = _final_pred(r)
        diff = abs(pred - gold)
        if diff >= 0.10 * r.get("max_marks", 7.0):
            dev_dump.append({
                "student_id": r.get("sample_id"),
                "instructor_marks": gold,
                "predicted_marks": pred,
                "diff": diff,
                "needs_human_review": r.get("needs_human_review"),
                "reasoning_excerpt": r.get("reasoning", "")[:300],
                "student_code_preview": r.get("student_answer_raw", "")[:200]
            })

    dump_path = os.path.join(real_dir, "dev_error_analysis.json")
    with open(dump_path, "w", encoding="utf-8") as f:
        json.dump(dev_dump, f, indent=2)
    logger.info(f"Dev error analysis dump ({len(dev_dump)} disagreements >= 10% max) saved to {dump_path}")

    # Display results
    print_results_table(real_metrics)

    # Save outputs
    for key, res in real_results.items():
        with open(os.path.join(real_dir, "predictions", f"{key}.jsonl"), "w", encoding="utf-8") as f:
            for r in res:
                f.write(json.dumps(r, ensure_ascii=False, default=str) + "\\n")

    with open(os.path.join(real_dir, "real_metrics.json"), "w", encoding="utf-8") as f:
        json.dump(real_metrics, f, indent=2, default=str)
`;
nb.cells[39].source = quiz3UpgradeCode.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

fs.writeFileSync('notebooks/nb3_infer.ipynb', JSON.stringify(nb, null, 1), 'utf8');
console.log('Successfully upgraded notebooks/nb3_infer.ipynb to Phase 4 v2 specs!');

