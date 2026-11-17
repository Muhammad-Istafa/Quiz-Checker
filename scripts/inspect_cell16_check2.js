const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));
const c = nb.cells[16];
const src = Array.isArray(c.source) ? c.source.join('') : c.source;
const lines = src.split('\n');
console.log(lines.slice(125, 170).map((l, i) => (i + 126).toString().padStart(4) + ': ' + l).join('\n'));
