const fs = require('fs');

const nb = JSON.parse(fs.readFileSync('notebooks/nb1_data.ipynb', 'utf8'));

// Let's collect all variable assignments across all cells
console.log('Total cells:', nb.cells.length);

for (let i = 25; i < nb.cells.length; i++) {
  const cell = nb.cells[i];
  if (cell.cell_type !== 'code') continue;
  const src = cell.source.join('');
  console.log(`--- Cell ${i} (${src.split('\n').length} lines) ---`);
  // Check for any pids or unusual references
  const lines = src.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('_pids') || l.includes('all_') || l.includes('assert ')) {
      console.log(`  L${idx+1}: ${l.trim()}`);
    }
  });
}

