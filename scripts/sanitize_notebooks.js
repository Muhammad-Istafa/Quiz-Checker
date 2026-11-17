const fs = require('fs');
const path = require('path');

const nbs = [
  'notebooks/n0_audit.ipynb',
  'notebooks/nb1_data.ipynb',
  'notebooks/nb1b_teacher.ipynb',
  'notebooks/nb2_train.ipynb',
  'notebooks/nb2b_nca.ipynb',
  'notebooks/nb3_infer.ipynb'
];

for (const nbFile of nbs) {
  const data = JSON.parse(fs.readFileSync(nbFile, 'utf8'));
  for (let i = 0; i < data.cells.length; i++) {
    const c = data.cells[i];
    if (c.cell_type === 'markdown') {
      delete c.execution_count;
      delete c.outputs;
    }
    if (!c.id) {
      c.id = 'cell-' + i;
    }
  }
  fs.writeFileSync(nbFile, JSON.stringify(data, null, 1), 'utf8');
  console.log(`Sanitized ${nbFile}`);
}

