const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

nb.cells.forEach((cell, idx) => {
  if (cell.cell_type !== 'code') return;
  const src = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
  if (src.includes('splits[') || src.includes('eval_split') || src.includes('run_batch_inference') || src.includes('ZS_SUBSETS')) {
    console.log(`=== Cell ${idx} ===`);
    const lines = src.split('\n');
    lines.forEach((l, i) => {
      if (l.includes('splits') || l.includes('eval_split') || l.includes('run_batch_inference') || l.includes('test_')) {
        console.log(`  ${i+1}: ${l}`);
      }
    });
  }
});
