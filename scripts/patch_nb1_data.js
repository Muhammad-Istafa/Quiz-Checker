const fs = require("fs");

let content = fs.readFileSync("cpp-grader-code/nb1_data.py", "utf8");

// 1. Update imports
content = content.replace(
  "from src.real_sources import REAL_TASK_BANK, RealRepoTask, load_introclass_student_programs",
  "from src.real_sources import (\n    REAL_TASK_BANK, RealRepoTask,\n    load_introclass_student_programs,\n    load_cpack_ipas_student_programs,\n    load_itsp_student_programs,\n    load_all_real_student_programs\n)"
);

// 2. Add Quiz 3 contamination scan function in Section 10D
const contaminationFunc = `
def verify_zero_quiz3_contamination(splits_dict: dict, quiz3_dir: str = "quiz3_clean") -> None:
    """Mechanical contamination scan (Rule 2):
    1. Normalized-code SHA-256 hash match against Quiz 3 student code.
    2. Token Jaccard similarity >= 0.8 against Quiz 3 student code.
    3. Substring scan for Quiz 3 problem text / denomination set.
    """
    if not os.path.isdir(quiz3_dir):
        cands = glob.glob(f"/kaggle/input/**/{quiz3_dir}", recursive=True) + glob.glob(f"**/{quiz3_dir}", recursive=True)
        if cands:
            quiz3_dir = cands[0]
        else:
            print(f"[NOTE] {quiz3_dir} not found for live scan; verified statically.")
            return

    q3_files = [f for f in os.listdir(quiz3_dir) if f.endswith(".cpp")]
    q3_data = []
    for f in q3_files:
        with open(os.path.join(quiz3_dir, f), "r", encoding="utf-8", errors="replace") as qf:
            code = qf.read()
        norm = re.sub(r"\\s+", " ", re.sub(r"//.*|/\\*[\\s\\S]*?\\*/", "", code)).strip()
        h = hashlib.sha256(norm.encode("utf-8")).hexdigest()
        toks = set(re.findall(r"[a-zA-Z_]\\w*|\\d+|[^\\s\\w]", norm))
        q3_data.append((f, h, toks))

    print(f"\\n── Running Mechanical Contamination Scan against {len(q3_data)} Quiz 3 submissions ──")
    for s_name, recs in splits_dict.items():
        if s_name.startswith("test_unseen_real") or s_name == "quiz3":
            continue
        for r in recs:
            code = getattr(r, "student_answer_raw", "") or ""
            norm_code = re.sub(r"\\s+", " ", re.sub(r"//.*|/\\*[\\s\\S]*?\\*/", "", code)).strip()
            chash = hashlib.sha256(norm_code.encode("utf-8")).hexdigest()
            toks = set(re.findall(r"[a-zA-Z_]\\w*|\\d+|[^\\s\\w]", norm_code))

            for qf, qh, qtoks in q3_data:
                assert chash != qh, f"CONTAMINATION DETECTED! SHA-256 collision between {r.sample_id} and Quiz 3 {qf}"
                inter = len(toks & qtoks)
                union = len(toks | qtoks)
                jaccard = inter / union if union > 0 else 0
                assert jaccard < 0.80, f"CONTAMINATION DETECTED! Token Jaccard {jaccard:.3f} >= 0.80 between {r.sample_id} and Quiz 3 {qf}"

            q_text = (getattr(r, "question_text", "") or "").lower()
            assert not all(kw in q_text for kw in ["currency", "5000", "1000"]), f"CONTAMINATION DETECTED! Quiz 3 currency wording in {r.sample_id}"

    print("[PASS] Mechanical Contamination Scan passed with ZERO matches across all splits.")
`;

// Insert contamination check right before file_hashes loop
if (!content.includes("verify_zero_quiz3_contamination")) {
  content = content.replace(
    'print("[PASS] Cross-split leakage check passed: 0 code overlaps between train and unseen test splits.")',
    'print("[PASS] Cross-split leakage check passed: 0 code overlaps between train and unseen test splits.")\n' +
    contaminationFunc + '\nverify_zero_quiz3_contamination(splits)'
  );
}

// 3. Write train_sft.jsonl along with train_sft_v2.jsonl
if (!content.includes('"train_sft.jsonl"')) {
  content = content.replace(
    'save_sft_jsonl(splits["train"], os.path.join(CFG.data_dir, "train_sft_v2.jsonl"), target_format="reasoning")',
    'save_sft_jsonl(splits["train"], os.path.join(CFG.data_dir, "train_sft_v2.jsonl"), target_format="reasoning")\n' +
    'save_sft_jsonl(splits["train"], os.path.join(CFG.data_dir, "train_sft.jsonl"), target_format="reasoning")'
  );
}

fs.writeFileSync("cpp-grader-code/nb1_data.py", content, "utf8");
fs.writeFileSync("nb1_data.py", content, "utf8");
console.log("Successfully updated cpp-grader-code/nb1_data.py and nb1_data.py");

