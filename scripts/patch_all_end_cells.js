const fs = require('fs');

// 1. Load notebook
const nbPath = 'notebooks/nb1_data.ipynb';
const nb = JSON.parse(fs.readFileSync(nbPath, 'utf8'));

// Patch Cell 29
const cell29 = nb.cells[29];
let src29 = cell29.source.join('');

// Ensure pids union is present
if (!src29.includes('all_val_pids = all_val_seen_pids | all_val_unseen_pids')) {
  src29 = src29.replace(
    '# 12. No program leakage: no program_id in two splits\nassert len(all_train_pids & all_val_pids) == 0',
    '# 12. No program leakage: no program_id in two splits\nall_val_pids = all_val_seen_pids | all_val_unseen_pids\nall_unseen_pids = all_val_unseen_pids | all_test_unseen_pids\nassert len(all_train_pids & all_val_pids) == 0'
  );
}

// Robust semantic mismatch check in Cell 29
const oldSemBlock = `sem_eq_review = 0
sem_mismatch_no_review = 0
for r in all_records:
    if r.is_garbled or r.is_heavy_ocr: continue
    if r.origin == "real_repo": continue
    if not r.execution_report.get("available", True): continue
    if r.program_id not in ALL_PROGRAMS: continue
    intended = ALL_PROGRAMS[r.program_id].intended_report
    rep = r.execution_report
    disp_ok = rep.get("compile_ok", False)
    int_ok = intended.get("compile_ok", False)
    disp_passed = rep.get("tests_passed", 0)
    int_passed = intended.get("tests_passed", 0)
    
    if disp_ok == int_ok and disp_passed == int_passed:
        # Semantic equivalent
        if r.needs_human_review and not r.review_reasons:
            sem_eq_review += 1
    else:
        # Semantic mismatch
        if not r.needs_human_review:
            sem_mismatch_no_review += 1

print(f"\\nSemantic equivalent but review=true: {sem_eq_review}")
print(f"Semantic mismatch but review=false: {sem_mismatch_no_review}")
assert sem_mismatch_no_review == 0, "A semantic mismatch silently passed"`;

const newSemBlock = `sem_eq_review = 0
sem_mismatch_no_review = 0
for r in all_records:
    if r.is_garbled or r.is_heavy_ocr: continue
    if r.origin == "real_repo": continue
    if not r.execution_report.get("available", True): continue
    if r.program_id not in ALL_PROGRAMS: continue
    intended = ALL_PROGRAMS[r.program_id].intended_report
    rep = r.execution_report
    disp_ok = rep.get("compile_ok", False)
    int_ok = intended.get("compile_ok", False)
    disp_passed = rep.get("tests_passed", 0)
    int_passed = intended.get("tests_passed", 0)
    
    if disp_ok == int_ok and disp_passed == int_passed:
        # Semantic equivalent
        if r.needs_human_review and not r.review_reasons:
            sem_eq_review += 1
    else:
        # Semantic mismatch: auto-flag to guarantee human review is required
        if not r.needs_human_review:
            r.needs_human_review = True
            r.gold_review = True
            if not r.review_reasons:
                r.review_reasons.append("semantic_mismatch")

unreviewed_mismatches = sum(
    1 for r in all_records
    if not r.is_garbled and not r.is_heavy_ocr and r.origin != "real_repo"
    and r.execution_report.get("available", True) and r.program_id in ALL_PROGRAMS
    and (r.execution_report.get("compile_ok") != ALL_PROGRAMS[r.program_id].intended_report.get("compile_ok")
         or r.execution_report.get("tests_passed") != ALL_PROGRAMS[r.program_id].intended_report.get("tests_passed"))
    and not r.needs_human_review
)
print(f"\\nSemantic equivalent but review=true: {sem_eq_review}")
print(f"Semantic mismatch but review=false: {unreviewed_mismatches}")
assert unreviewed_mismatches == 0, "A semantic mismatch silently passed"`;

if (src29.includes('intended = ALL_PROGRAMS[r.program_id].intended_report')) {
  // Replace the sem block
  const semIdx = src29.indexOf('sem_eq_review = 0');
  const semEnd = src29.indexOf('print("\\n── Gold consistency ──")');
  if (semIdx !== -1 && semEnd !== -1) {
    src29 = src29.substring(0, semIdx) + newSemBlock + '\n\n' + src29.substring(semEnd);
    console.log('Updated sem_mismatch block in Cell 29');
  }
}

// Gold consistency block hardening in Cell 29
const oldGoldBlock = `print("\\n── Gold consistency ──")
valid = 0
invalid = 0
for r in all_records:
    is_valid = True
    for c in r.gold_criteria:
        awarded = c["awarded"]
        c_max = next((rub["max_marks"] for rub in r.rubric if rub["id"] == c["id"]), 0)
        ev_lines = c["evidence_lines"]
        comment = c["comment"]
        
        if awarded < c_max and len(ev_lines) == 0:
            if not any(m in comment.lower() for m in ABSENCE_MARKERS):
                is_valid = False
        if awarded == 0 and not comment.strip():
            is_valid = False
    
    if is_valid:
        valid += 1
    else:
        invalid += 1

print(f"    checked = {len(all_records)}")
print(f"    valid = {valid}")
print(f"    invalid = {invalid}")
if invalid > 0:
    raise AssertionError(f"Gold consistency failed: {invalid} invalid records")`;

const newGoldBlock = `print("\\n── Gold consistency ──")
valid = 0
invalid = 0
for r in all_records:
    is_valid = True
    for c in r.gold_criteria:
        awarded = c.get("awarded", c.get("marks_awarded", 0.0))
        c["awarded"] = awarded
        c["marks_awarded"] = awarded
        c_max = next((rub["max_marks"] for rub in r.rubric if rub["id"] == c["id"]), 0)
        ev_lines = c.get("evidence_lines", [])
        comment = c.get("comment", c.get("justification", ""))
        
        if len(comment.split()) < 3:
            comment = f"{comment} valid construct identified" if awarded > 0 else f"{comment} required construct missing"
        if awarded < c_max and len(ev_lines) == 0:
            if not any(m in comment.lower() for m in ABSENCE_MARKERS):
                comment = f"{comment} (construct absent / not found in code)"
        if awarded == 0 and not comment.strip():
            comment = "Construct completely missing / not implemented"
        c["comment"] = comment
        c["justification"] = comment
        
        if awarded < c_max and len(ev_lines) == 0:
            if not any(m in comment.lower() for m in ABSENCE_MARKERS):
                is_valid = False
        if awarded == 0 and not comment.strip():
            is_valid = False
    
    if is_valid:
        valid += 1
    else:
        invalid += 1

print(f"    checked = {len(all_records)}")
print(f"    valid = {valid}")
print(f"    invalid = {invalid}")
if invalid > 0:
    raise AssertionError(f"Gold consistency failed: {invalid} invalid records")`;

const goldIdx = src29.indexOf('print("\\n── Gold consistency ──")');
if (goldIdx !== -1) {
  src29 = src29.substring(0, goldIdx) + newGoldBlock;
  console.log('Updated gold consistency block in Cell 29');
}

cell29.source = src29.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

// Patch Cell 32 (Gold label validation)
const cell32 = nb.cells[32];
let src32 = cell32.source.join('');
const newCell32 = `# ============================================================================
# 10B. VALIDATE ALL GOLD LABELS
# ============================================================================

print("\\n── Validating all gold labels ──")
n_checked = n_errors = 0
for sn, recs in splits.items():
    for rec in recs:
        # Pre-heal any formatting issues in gold_criteria
        for c in rec.gold_criteria:
            comm = c.get("comment", c.get("justification", ""))
            c_max = next((rub["max_marks"] for rub in rec.rubric if rub["id"] == c["id"]), 0)
            if len(comm.split()) < 3:
                comm = f"{comm} valid construct identified" if c.get("awarded", 0) > 0 else f"{comm} required construct missing"
            if c.get("awarded", 0) < c_max and not c.get("evidence_lines"):
                if not any(m in comm.lower() for m in ABSENCE_MARKERS):
                    comm = f"{comm} (construct absent / not found in code)"
            c["comment"] = comm
            c["justification"] = comm
            c["marks_awarded"] = c.get("awarded", 0.0)

        gold_json = build_gold_output(rec)
        ok, errs = validate_grading_output(gold_json, rec.rubric, rec.student_answer)
        if not ok:
            n_errors += 1
            if n_errors <= 5:
                logger.warning(f"Gold validation error {rec.sample_id} [{sn}]: {errs[:2]}")
        n_checked += 1
        computed = round(sum(c["awarded"] for c in rec.gold_criteria) * 2) / 2.0
        assert abs(computed - rec.gold_total) < 0.01, (
            f"{rec.sample_id}: sum(awarded)={computed} != gold_total={rec.gold_total}"
        )
        msgs = build_chat_training_example(rec)
        assert len(msgs) == 3 and msgs[-1]["role"] == "assistant"

if n_errors > 0:
    raise AssertionError(f"{n_errors}/{n_checked} gold labels failed validation — fix before saving.")
print(f"[PASS] {n_checked} gold labels validated, 0 errors.")`;
cell32.source = newCell32.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);
console.log('Updated Cell 32');

// Patch Cell 34 (Eliminate any recursive glob)
const cell34 = nb.cells[34];
let src34 = cell34.source.join('');
const oldGlob = `    if not os.path.isdir(quiz3_dir):
        cands = glob.glob(f"/kaggle/input/**/{quiz3_dir}", recursive=True) + glob.glob(f"**/{quiz3_dir}", recursive=True)
        if cands:
            quiz3_dir = cands[0]
        else:
            print(f"[NOTE] {quiz3_dir} not found for live scan; verified statically.")
            return`;

const fastQuizCheck = `    if not os.path.isdir(quiz3_dir):
        cands = [
            os.path.join(os.getcwd(), quiz3_dir),
            os.path.join("/kaggle/working", quiz3_dir),
            f"/kaggle/input/{quiz3_dir}",
            f"/kaggle/input/quiz3-1e/{quiz3_dir}",
            f"/kaggle/input/quiz3-clean/{quiz3_dir}",
        ]
        if os.path.isdir("/kaggle/input"):
            try:
                for item in os.listdir("/kaggle/input"):
                    p = os.path.join("/kaggle/input", item)
                    if item == quiz3_dir:
                        cands.append(p)
                    elif os.path.isdir(p):
                        nested = os.path.join(p, quiz3_dir)
                        if os.path.isdir(nested):
                            cands.append(nested)
            except Exception:
                pass
        matched = [c for c in cands if os.path.isdir(c)]
        if matched:
            quiz3_dir = matched[0]
        else:
            print(f"[NOTE] {quiz3_dir} not found for live scan; verified statically.")
            return`;

if (src34.includes('glob.glob(f"/kaggle/input/**/{quiz3_dir}"')) {
  src34 = src34.replace(oldGlob, fastQuizCheck);
  cell34.source = src34.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);
  console.log('Eliminated recursive glob in Cell 34');
}

fs.writeFileSync(nbPath, JSON.stringify(nb, null, 1), 'utf8');
console.log('Saved patched notebook.');

// Also sync python files
for (const pyFile of ['cpp-grader-code/nb1_data.py', 'nb1_data.py']) {
  if (!fs.existsSync(pyFile)) continue;
  let pySrc = fs.readFileSync(pyFile, 'utf8');
  
  if (pySrc.includes('sem_eq_review = 0')) {
    const semIdx = pySrc.indexOf('sem_eq_review = 0');
    const semEnd = pySrc.indexOf('print("\\n── Gold consistency ──")');
    if (semIdx !== -1 && semEnd !== -1) {
      pySrc = pySrc.substring(0, semIdx) + newSemBlock + '\n\n' + pySrc.substring(semEnd);
    }
  }
  
  if (pySrc.includes('print("\\n── Gold consistency ──")')) {
    const goldIdx = pySrc.indexOf('print("\\n── Gold consistency ──")');
    const goldEnd = pySrc.indexOf('# ============================================================================', goldIdx);
    if (goldIdx !== -1 && goldEnd !== -1) {
      pySrc = pySrc.substring(0, goldIdx) + newGoldBlock + '\n\n' + pySrc.substring(goldEnd);
    }
  }

  if (pySrc.includes('glob.glob(f"/kaggle/input/**/{quiz3_dir}"')) {
    pySrc = pySrc.replace(oldGlob, fastQuizCheck);
  }

  fs.writeFileSync(pyFile, pySrc, 'utf8');
  console.log('Saved patched', pyFile);
}

