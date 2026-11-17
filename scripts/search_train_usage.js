const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

nb.cells.forEach((cell, idx) => {
  if (cell.cell_type !== 'code') return;
  const src = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
  const lines = src.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('"train"') || l.includes("'train'")) {
      console.log(`Cell ${idx} Line ${i+1}: ${l}`);
    }
  });
});
