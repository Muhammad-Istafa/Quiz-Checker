const fs = require("fs");

let content = fs.readFileSync("cpp-grader-code/n0_audit.py", "utf8");

const auditContamination = `
def audit_quiz3_contamination(splits: dict, quiz3_dir: str = "quiz3_clean") -> dict:
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
            return {"status": "not_measured", "reason": "quiz3_clean directory not found"}

    q3_files = [f for f in os.listdir(quiz3_dir) if f.endswith(".cpp")]
    q3_data = []
    for f in q3_files:
        with open(os.path.join(quiz3_dir, f), "r", encoding="utf-8", errors="replace") as qf:
            code = qf.read()
        norm = re.sub(r"\\s+", " ", re.sub(r"//.*|/\\*[\\s\\S]*?\\*/", "", code)).strip()
        h = hashlib.sha256(norm.encode("utf-8")).hexdigest()
        toks = set(re.findall(r"[a-zA-Z_]\\w*|\\d+|[^\\s\\w]", norm))
        q3_data.append((f, h, toks))

    collisions = []
    high_jaccard = []
    for s_name, recs in splits.items():
        if s_name.startswith("test_unseen_real") or s_name == "quiz3":
            continue
        for r in recs:
            code = r.get("student_answer_raw", "") or ""
            norm_code = re.sub(r"\\s+", " ", re.sub(r"//.*|/\\*[\\s\\S]*?\\*/", "", code)).strip()
            chash = hashlib.sha256(norm_code.encode("utf-8")).hexdigest()
            toks = set(re.findall(r"[a-zA-Z_]\\w*|\\d+|[^\\s\\w]", norm_code))

            for qf, qh, qtoks in q3_data:
                if chash == qh:
                    collisions.append({"sample_id": r.get("sample_id"), "quiz3_file": qf})
                inter = len(toks & qtoks)
                union = len(toks | qtoks)
                jaccard = inter / union if union > 0 else 0
                if jaccard >= 0.80:
                    high_jaccard.append({"sample_id": r.get("sample_id"), "quiz3_file": qf, "jaccard": jaccard})

    return {
        "status": "passed" if not collisions and not high_jaccard else "FAILED",
        "quiz3_inspected_count": len(q3_data),
        "exact_collisions_count": len(collisions),
        "high_jaccard_count": len(high_jaccard),
        "collisions": collisions[:5],
        "high_jaccard": high_jaccard[:5]
    }
`;

if (!content.includes("audit_quiz3_contamination")) {
  content = content.replace("def leakage(splits: dict) -> dict:", auditContamination + "\ndef leakage(splits: dict) -> dict:");
  content = content.replace('out.update(leakage(splits))', 'out.update(leakage(splits))\n    out["quiz3_firewall_audit"] = audit_quiz3_contamination(splits)');
}

fs.writeFileSync("cpp-grader-code/n0_audit.py", content, "utf8");
fs.writeFileSync("n0_audit.py", content, "utf8");
console.log("Successfully updated cpp-grader-code/n0_audit.py and n0_audit.py");

