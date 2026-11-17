const fs = require('fs');

const target = `sem_eq_review = 0
sem_mismatch_no_review = 0
for r in all_records:
    if r.is_garbled or r.is_heavy_ocr: continue
    intended = ALL_PROGRAMS[r.program_id].intended_report
    rep = r.execution_report`;

const replacement = `sem_eq_review = 0
sem_mismatch_no_review = 0
for r in all_records:
    if r.is_garbled or r.is_heavy_ocr: continue
    if r.origin == "real_repo": continue
    if not r.execution_report.get("available", True): continue
    if r.program_id not in ALL_PROGRAMS: continue
    intended = ALL_PROGRAMS[r.program_id].intended_report
    rep = r.execution_report`;

// 1. Patch notebook
const nb = JSON.parse(fs.readFileSync('notebooks/nb1_data.ipynb', 'utf8'));
let foundNb = false;
for (const cell of nb.cells) {
  if (cell.cell_type === 'code') {
    let src = cell.source.join('');
    if (src.includes(target)) {
      src = src.replace(target, replacement);
      cell.source = src.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);
      foundNb = true;
      break;
    }
  }
}
if (foundNb) {
  fs.writeFileSync('notebooks/nb1_data.ipynb', JSON.stringify(nb, null, 1), 'utf8');
  console.log('Successfully patched notebooks/nb1_data.ipynb');
} else {
  console.log('Target not found in notebooks/nb1_data.ipynb');
}

// 2. Patch python scripts
for (const p of ['cpp-grader-code/nb1_data.py', 'nb1_data.py']) {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    if (content.includes(target)) {
      content = content.replace(target, replacement);
      fs.writeFileSync(p, content, 'utf8');
      console.log('Successfully patched', p);
    } else {
      console.log('Target not found in', p);
    }
  }
}

