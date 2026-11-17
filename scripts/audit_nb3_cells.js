const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

console.log(`Total cells in nb3: ${nb.cells.length}`);

nb.cells.forEach((cell, idx) => {
  if (cell.cell_type !== 'code') return;
  const src = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
  const lines = src.split('\n');
  const firstLine = lines.find(l => l.trim().length > 0) || '';
  
  // Check for suspicious 'return ' at column 0 (outside any function)
  const suspiciousReturns = [];
  lines.forEach((line, lIdx) => {
    // If line starts with return (0 indentation)
    if (/^\s*return\b/.test(line)) {
      const indent = line.search(/\S/);
      if (indent === 0) {
        suspiciousReturns.push({ line: lIdx + 1, content: line.trim() });
      }
    }
  });

  // Check unindented try / except blocks
  const unindentedBlocks = [];
  let inDef = false;
  let defIndent = 0;
  lines.forEach((line, lIdx) => {
    const trimmed = line.trim();
    if (/^def\s+[a-zA-Z0-9_]+\s*\(/.test(trimmed)) {
      inDef = true;
      defIndent = line.search(/\S/);
    }
    if (inDef && /^(try:|except.*:|if\s+|for\s+|while\s+|with\s+)/.test(line)) {
      // starts at column 0 despite being inside a function logic
      unindentedBlocks.push({ line: lIdx + 1, content: line });
    }
  });

  console.log(`Cell ${idx.toString().padStart(2)}: ${lines.length.toString().padStart(3)} lines | ${firstLine.slice(0, 60)}`);
  if (suspiciousReturns.length > 0) {
    console.log(`  --> SUSPICIOUS RETURN at col 0:`, suspiciousReturns);
  }
  if (unindentedBlocks.length > 0) {
    console.log(`  --> UNINDENTED BLOCK:`, unindentedBlocks);
  }
});
