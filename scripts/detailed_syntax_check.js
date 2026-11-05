const fs = require('fs');

const students = JSON.parse(fs.readFileSync('quiz3_raw/quiz3_students.json', 'utf8'));

const report = [];

students.forEach((s, idx) => {
    const code = s.solution;
    const lines = code.split('\n');
    
    // Check header junk
    let hasHeaderJunk = false;
    let junkLinesCount = 0;
    if (lines[0].trim().startsWith('Question #')) {
        hasHeaderJunk = true;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('#include') || lines[i].trim().startsWith('using namespace') || lines[i].trim().startsWith('int main')) {
                junkLinesCount = i;
                break;
            }
        }
    }

    // Check balance of braces
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    const braceUnbalanced = openBraces !== closeBraces;

    // Check main function
    const hasMain = /(int|void)\s+main\s*\(/.test(code);

    // Check includes
    const hasIOStream = /#\s*include\s*<iostream>/.test(code);
    const hasStdio = /#\s*include\s*<stdio\.h>/.test(code);

    // Check known syntax blockers
    const syntaxErrors = [];
    if (braceUnbalanced) {
        syntaxErrors.push(`Unbalanced braces (${openBraces} open vs ${closeBraces} close)`);
    }
    if (!hasMain) {
        syntaxErrors.push('Missing main function');
    }
    if (!hasIOStream && !hasStdio) {
        syntaxErrors.push('Missing I/O headers');
    }
    if (hasHeaderJunk) {
        syntaxErrors.push(`Header junk (${junkLinesCount} lines)`);
    }

    // Check line by line for obvious syntax errors
    // e.g. assignments to expressions: `x / 10 = x`
    if (/[\w\s]+[+\-*\/%][\w\s]+=\s*[\w\s]+;/.test(code)) {
        syntaxErrors.push('L-value error (expression on left of assignment)');
    }
    // incomplete statements at end
    const trimmedNonEmpty = lines.map(l => l.trim()).filter(l => l.length > 0);
    const lastCodeLine = trimmedNonEmpty[trimmedNonEmpty.length - 1];

    report.push({
        idx: idx + 1,
        roll: s.rollNo,
        gt: s.gt,
        hasHeaderJunk,
        junkLinesCount,
        braceUnbalanced,
        hasMain,
        syntaxErrors,
        codeLength: code.length
    });
});

console.log('Summary of 46 submissions:');
console.log('Submissions with syntaxErrors:', report.filter(r => r.syntaxErrors.length > 0).length);
report.filter(r => r.syntaxErrors.length > 0).forEach(r => {
    console.log(`[${r.idx}] ${r.roll} (GT: ${r.gt}): ${r.syntaxErrors.join('; ')}`);
});

