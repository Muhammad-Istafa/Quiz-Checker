const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

let src6 = Array.isArray(nb.cells[6].source) ? nb.cells[6].source.join('') : nb.cells[6].source;

// Look for lines around line 90-100
const lines = src6.split('\n');
const fixedLines = [];
let skipUntilParen = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('raise FileNotFoundError(') && lines[i+1] && lines[i+1].includes('No NB1 dataset found')) {
    fixedLines.push('    raise FileNotFoundError(');
    fixedLines.push('        f"No NB1 dataset found (looked for {required_file}). Attach the dataset or set DATA_DIR."');
    fixedLines.push('    )');
    // Skip old lines until we reach line 100 (# --- 1. Config Object)
    i += 1;
    while (i < lines.length && !lines[i].includes('# 1. Config Object') && !lines[i].includes('@dataclass')) {
      i++;
    }
    i--; // rewind one so loop catches '# 1. Config Object'
    continue;
  }
  fixedLines.push(line);
}

nb.cells[6].source = fixedLines.join('\n');
fs.writeFileSync('notebooks/nb3_infer.ipynb', JSON.stringify(nb, null, 1), 'utf8');
console.log('Fixed Cell 6 lines successfully.');
