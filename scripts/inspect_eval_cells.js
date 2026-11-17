const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

[20, 21, 22, 23, 24, 25, 27, 28, 29, 30].forEach(idx => {
  const c = nb.cells[idx];
  if (!c) return;
  const src = Array.isArray(c.source) ? c.source.join('') : c.source;
  console.log(`=== Cell ${idx} (${c.cell_type}) ===`);
  console.log(src.slice(0, 300));
});
