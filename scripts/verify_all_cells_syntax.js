const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

console.log('=== Checking all notebook cells for python syntax patterns ===');

nb.cells.forEach((cell, idx) => {
  if (cell.cell_type !== 'code') return;
  const src = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
  const lines = src.split('\n');

  // Check bracket balance
  let parens = 0, brackets = 0, braces = 0;
  let inSingleQuote = false, inDoubleQuote = false, inTripleSingle = false, inTripleDouble = false;
  // Simple heuristic check for unclosed multiline strings or braces
  lines.forEach((l, lIdx) => {
    // Check if return is at indentation 0
    if (/^return\b/.test(l.trim()) && l.search(/\S/) === 0) {
      console.log(`Cell ${idx} Line ${lIdx+1}: return at column 0!`);
    }
  });
});
console.log('Done scanning.');
