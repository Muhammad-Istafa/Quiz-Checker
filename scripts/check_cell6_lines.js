const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));
const lines = (Array.isArray(nb.cells[6].source) ? nb.cells[6].source.join('') : nb.cells[6].source).split('\n');
console.log(lines.slice(80, 110).map((l, i) => (i + 81).toString().padStart(3) + ': ' + l).join('\n'));
