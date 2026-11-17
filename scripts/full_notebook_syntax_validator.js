const fs = require('fs');

const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

console.log('=== Running Comprehensive Syntax Audit on all cells ===');

let totalErrors = 0;

nb.cells.forEach((cell, cellIdx) => {
  if (cell.cell_type !== 'code') return;
  const src = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
  const lines = src.split('\n');

  // Check paren/bracket/brace nesting
  let paren = 0, bracket = 0, brace = 0;
  let inTripleDouble = false, inTripleSingle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let j = 0;
    while (j < line.length) {
      // Check multiline quotes
      if (!inTripleSingle && line.startsWith('"""', j)) {
        inTripleDouble = !inTripleDouble;
        j += 3;
        continue;
      }
      if (!inTripleDouble && line.startsWith("'''", j)) {
        inTripleSingle = !inTripleSingle;
        j += 3;
        continue;
      }
      if (inTripleDouble || inTripleSingle) {
        j++;
        continue;
      }

      // Check comments
      if (line[j] === '#') {
        break; // rest of line is comment
      }

      // Single line string
      if (line[j] === '"' || line[j] === "'") {
        const q = line[j];
        j++;
        while (j < line.length) {
          if (line[j] === '\\') {
            j += 2; // skip escaped
            continue;
          }
          if (line[j] === q) {
            j++; // closed
            break;
          }
          j++;
        }
        continue;
      }

      // Parentheses & Brackets
      if (line[j] === '(') paren++;
      else if (line[j] === ')') paren--;
      else if (line[j] === '[') bracket++;
      else if (line[j] === ']') bracket--;
      else if (line[j] === '{') brace++;
      else if (line[j] === '}') brace--;

      if (paren < 0) {
        console.error(`[ERROR] Cell ${cellIdx} Line ${i+1}: Extra closing parenthesis ')'!`);
        totalErrors++;
        paren = 0;
      }
      if (bracket < 0) {
        console.error(`[ERROR] Cell ${cellIdx} Line ${i+1}: Extra closing bracket ']'!`);
        totalErrors++;
        bracket = 0;
      }
      if (brace < 0) {
        console.error(`[ERROR] Cell ${cellIdx} Line ${i+1}: Extra closing brace '}'!`);
        totalErrors++;
        brace = 0;
      }
      j++;
    }
  }

  if (paren !== 0) {
    console.error(`[ERROR] Cell ${cellIdx}: Unclosed parentheses (balance: ${paren})!`);
    totalErrors++;
  }
  if (bracket !== 0) {
    console.error(`[ERROR] Cell ${cellIdx}: Unclosed brackets (balance: ${bracket})!`);
    totalErrors++;
  }
  if (brace !== 0) {
    console.error(`[ERROR] Cell ${cellIdx}: Unclosed braces (balance: ${brace})!`);
    totalErrors++;
  }
  if (inTripleDouble || inTripleSingle) {
    console.error(`[ERROR] Cell ${cellIdx}: Unclosed multiline string!`);
    totalErrors++;
  }
});

console.log(`=== Audit Completed. Total Errors Found: ${totalErrors} ===`);
