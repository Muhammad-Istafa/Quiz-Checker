const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));
const c = nb.cells[28];
console.log('Cell 28:\n', Array.isArray(c.source) ? c.source.join('') : c.source);
