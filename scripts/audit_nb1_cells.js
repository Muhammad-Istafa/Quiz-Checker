const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb1_data.ipynb', 'utf8'));

console.log('Total cells:', nb.cells.length);
nb.cells.forEach((c, i) => {
  const src = Array.isArray(c.source) ? c.source.join('') : c.source;
  const first = src.trim().split('\n')[0] || '';
  console.log('Cell ' + i + ' [' + c.cell_type + ']: ' + first.slice(0, 80));
});

