const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));
const c = nb.cells[38];
const src = Array.isArray(c.source) ? c.source.join('') : c.source;
const lines = src.split('\n');
const idx = lines.findIndex(l => l.includes('def _read_excel_quiz'));
console.log(lines.slice(idx, idx + 80).join('\n'));
