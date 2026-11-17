const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));
const c = nb.cells[16];
const src = Array.isArray(c.source) ? c.source.join('') : c.source;
fs.writeFileSync('scripts/cell16_raw.py', src, 'utf8');
console.log('Cell 16 written to scripts/cell16_raw.py. Total length:', src.length);
