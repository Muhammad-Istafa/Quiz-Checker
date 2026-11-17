const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb1_data.ipynb', 'utf8'));

for (let i = 29; i < nb.cells.length; i++) {
  console.log(`\n==================== Cell ${i} (${nb.cells[i].cell_type}) ====================`);
  console.log(nb.cells[i].source.join(''));
}

