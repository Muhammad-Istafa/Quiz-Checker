const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

[38, 39].forEach(idx => {
  const c = nb.cells[idx];
  const src = Array.isArray(c.source) ? c.source.join('') : c.source;
  console.log(`=== Cell ${idx} ===`);
  console.log(src.slice(0, 1000));
  console.log('... total length:', src.length);
});
