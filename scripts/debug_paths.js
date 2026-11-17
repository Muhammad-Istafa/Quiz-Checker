const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

// Check Cell 5
const c5 = nb.cells[5];
const src5 = Array.isArray(c5.source) ? c5.source.join('') : c5.source;
const idx = src5.indexOf('_CANONICAL_PATHS');
if (idx !== -1) {
  console.log('=== Cell 5 _CANONICAL_PATHS ===');
  console.log(src5.slice(idx, idx + 1200));
}

// Check Cell 6
const c6 = nb.cells[6];
const src6 = Array.isArray(c6.source) ? c6.source.join('') : c6.source;
console.log('=== Cell 6 data_dir resolution ===');
const lines6 = src6.split('\n');
lines6.forEach((l, i) => {
  if (l.includes('data_dir') || l.includes('DATA_DIR')) {
    console.log(`${i+1}: ${l}`);
  }
});
