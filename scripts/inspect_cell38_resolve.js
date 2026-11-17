const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));
const c = nb.cells[38];
const src = Array.isArray(c.source) ? c.source.join('') : c.source;
const lines = src.split('\n');
console.log(lines.slice(15, 65).join('\n'));
