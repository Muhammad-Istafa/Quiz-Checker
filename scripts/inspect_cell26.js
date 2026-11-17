const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));
const c = nb.cells[26];
const src = Array.isArray(c.source) ? c.source.join('') : c.source;
console.log('=== Cell 26 ===');
console.log(src);
