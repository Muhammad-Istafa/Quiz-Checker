const fs = require('fs');

const target = `# 12. No program leakage: no program_id in two splits
assert len(all_train_pids & all_val_pids) == 0`;

const replacement = `# 12. No program leakage: no program_id in two splits
all_val_pids = all_val_seen_pids | all_val_unseen_pids
all_unseen_pids = all_val_unseen_pids | all_test_unseen_pids
assert len(all_train_pids & all_val_pids) == 0`;

for (const p of ['notebooks/nb1_data.ipynb', 'cpp-grader-code/nb1_data.py', 'nb1_data.py']) {
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

