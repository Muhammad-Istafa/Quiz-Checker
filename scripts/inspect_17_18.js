const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

[17, 18].forEach(idx => {
  const c = nb.cells[idx];
  const src = Array.isArray(c.source) ? c.source.join('') : c.source;
  console.log(`=== Cell ${idx} ===`);
  console.log(src);
});
