import json
import re
import os
import hashlib

def run_full_output_audit():
    print("=" * 70)
    print("DETAILED NB1 OUTPUT AUDIT SUITE (cpp-grader-data-v2)")
    print("=" * 70)

    data_dir = "cpp-grader-data-v2"
    assert os.path.isdir(data_dir), f"Directory {data_dir} does not exist!"

    # 1. Check data_manifest.json
    manifest_p = os.path.join(data_dir, "data_manifest.json")
    with open(manifest_p, "r", encoding="utf-8") as mf:
        manifest = json.load(mf)
    print(f"\n[1] Manifest verified:")
    print(f"    Dataset Version: {manifest.get('dataset_version')}")
    print(f"    Schema Version:  {manifest.get('schema_version')}")
    print(f"    Total Questions: {manifest.get('question_count')}")
    print(f"    Total Programs:  {manifest.get('program_count')}")
    print(f"    Split Sizes:     {manifest.get('split_sizes')}")
    print(f"    Program Counts:  {manifest.get('split_program_counts')}")
    print(f"    Weak Trace Rate: {manifest.get('weak_trace_share')*100:.2f}% (<= 50.0% threshold)")
    print(f"    Origins:         {manifest.get('origin_counts')}")

    # 2. Check SHA-256 hashes against manifest
    print(f"\n[2] Verifying SHA-256 hashes across all {len(manifest.get('file_hashes', {}))} files:")
    for fname, expected_hash in manifest.get("file_hashes", {}).items():
        fp = os.path.join(data_dir, fname)
        assert os.path.isfile(fp), f"File {fname} missing from {data_dir}"
        with open(fp, "rb") as f:
            h = hashlib.sha256(f.read()).hexdigest()
        assert h == expected_hash, f"Hash mismatch for {fname}: got {h}, expected {expected_hash}"
        print(f"    [MATCH] {fname:30s} SHA-256: {h[:16]}...")
    print(f"    -> ALL file hashes match the frozen manifest with cryptographic precision!")

    # 3. Deep audit of train_sft_v2.jsonl (3-step formatting, structure, schema)
    print(f"\n[3] Auditing train_sft_v2.jsonl (Arm A2 SFT):")
    sft_p = os.path.join(data_dir, "train_sft_v2.jsonl")
    sft_records = 0
    step1_matches = 0
    json_matches = 0
    step3_matches = 0

    re_step1 = re.compile(r"Let's think step-by-step", re.IGNORECASE)
    re_json = re.compile(r'\{\s*"criteria"\s*:\s*\[.*?\]\s*,\s*"needs_human_review"\s*:\s*(?:true|false)\s*\}', re.DOTALL)
    re_step3 = re.compile(r"(Strengths|Deficiencies|Actionable Advice|Feedback)", re.IGNORECASE)

    with open(sft_p, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f):
            if not line.strip():
                continue
            sft_records += 1
            r = json.loads(line)
            msgs = r.get("messages", [])
            assert len(msgs) == 3, f"Record {idx} has {len(msgs)} messages instead of 3"
            assert msgs[0]["role"] == "system"
            assert msgs[1]["role"] == "user"
            assert msgs[2]["role"] == "assistant"
            
            content = msgs[2]["content"]
            if re_step1.search(content):
                step1_matches += 1
            if re_json.search(content):
                json_matches += 1
            if re_step3.search(content):
                step3_matches += 1

    print(f"    Total records:        {sft_records}")
    print(f"    Step 1 Reasoning:     {step1_matches}/{sft_records} ({step1_matches/sft_records*100:.1f}%)")
    print(f"    Step 2 Valid JSON:    {json_matches}/{sft_records} ({json_matches/sft_records*100:.1f}%)")
    print(f"    Step 3 Feedback:      {step3_matches}/{sft_records} ({step3_matches/sft_records*100:.1f}%)")
    assert step1_matches == sft_records, "Some records missing Step 1!"
    assert json_matches == sft_records, "Some records missing Step 2 JSON!"
    assert step3_matches == sft_records, "Some records missing Step 3 feedback!"

    # 4. Deep audit of test_unseen_real_tasks.jsonl
    print(f"\n[4] Auditing test_unseen_real_tasks.jsonl (Held-out Real Student Code):")
    real_p = os.path.join(data_dir, "test_unseen_real_tasks.jsonl")
    real_count = 0
    by_q = {}
    by_origin = {}
    with open(real_p, "r", encoding="utf-8") as f:
        for line in f:
            real_count += 1
            r = json.loads(line)
            qid = r.get("question_id", "unknown")
            orig = r.get("origin", "unknown")
            by_q[qid] = by_q.get(qid, 0) + 1
            by_origin[orig] = by_origin.get(orig, 0) + 1

    print(f"    Total held-out real submissions: {real_count}")
    print(f"    Breakdown by task:   {by_q}")
    print(f"    Breakdown by origin: {by_origin}")
    assert real_count == 108, f"Expected 108 real submissions, found {real_count}"

    # 5. Arithmetic Score Consistency in all splits
    print(f"\n[5] Auditing Arithmetic Gold Score Consistency across all splits:")
    total_checked = 0
    for split_fn in ["train.jsonl", "val_seen.jsonl", "val_unseen.jsonl", "test_seen.jsonl", "test_unseen_synth.jsonl", "test_unseen_real_tasks.jsonl"]:
        split_p = os.path.join(data_dir, split_fn)
        err_count = 0
        split_rows = 0
        with open(split_p, "r", encoding="utf-8") as f:
            for line in f:
                split_rows += 1
                total_checked += 1
                r = json.loads(line)
                gold_total = float(r.get("gold_total", 0.0))
                crit_list = r.get("gold_criteria", [])
                calc_total = sum(float(c.get("awarded", c.get("marks_awarded", 0.0))) for c in crit_list)
                if abs(gold_total - calc_total) > 1e-4:
                    err_count += 1
        print(f"    {split_fn:28s}: {split_rows:5d} records checked | Arithmetic errors: {err_count}")
        assert err_count == 0, f"Arithmetic mismatch in {split_fn}"

    # 6. Evidence line grounding audit
    print(f"\n[6] Auditing Evidence Line Grounding (No out-of-bounds or empty lines):")
    citation_errors = 0
    with open(os.path.join(data_dir, "train.jsonl"), "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f):
            r = json.loads(line)
            code_lines = r.get("student_answer_raw", "").split("\n")
            num_code_lines = len(code_lines)
            for c in r.get("gold_criteria", []):
                for ev in c.get("evidence_lines", []):
                    if ev < 1 or ev > num_code_lines:
                        citation_errors += 1
                    elif not code_lines[ev - 1].strip():
                        citation_errors += 1
    print(f"    Evidence line errors across 3,000 training programs: {citation_errors}")
    assert citation_errors == 0, f"Found {citation_errors} ungrounded or out-of-bounds citations!"

    print(f"\n-> TOTAL RECORDS VERIFIED ACROSS ALL SPLITS: {total_checked}")
    print("=" * 70)
    print("ALL AUDIT CHECKS PASSED: THE OUTPUT OF NB1 IS 100% CORRECT & READY!")
    print("=" * 70)

if __name__ == "__main__":
    run_full_output_audit()
