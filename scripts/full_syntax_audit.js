const fs = require('fs');

const students = JSON.parse(fs.readFileSync('quiz3_raw/quiz3_students.json', 'utf8'));

// Let's analyze each file thoroughly
const compileResults = [];

students.forEach((s, idx) => {
    let code = s.solution;
    const roll = s.rollNo;
    const gt = s.gt;
    
    const errors = [];
    
    // Check 1: Header junk
    let cleaned = code;
    let junkFound = false;
    if (code.trim().startsWith('Question #')) {
        junkFound = true;
        const match = code.match(/(#include[\s\S]*|using namespace[\s\S]*|int main[\s\S]*)/);
        if (match) {
            cleaned = match[1];
        }
        errors.push({ type: 'ocr_header_junk', msg: 'Prompt text prepended to code' });
    }

    // Check 2: Missing main
    if (!/(int|void)\s+main\s*\(/.test(cleaned)) {
        errors.push({ type: 'missing_main', msg: 'No main function defined' });
    }

    // Check 3: Missing includes
    if (!/#\s*include\s*<[a-zA-Z0-9_\.]+>/.test(cleaned)) {
        errors.push({ type: 'missing_include', msg: 'No #include directives' });
    }

    // Check 4: Unbalanced braces
    const openB = (cleaned.match(/{/g) || []).length;
    const closeB = (cleaned.match(/}/g) || []).length;
    if (openB !== closeB) {
        errors.push({ type: 'unbalanced_braces', msg: `${openB} '{' vs ${closeB} '}'` });
    }

    // Check 5: Syntax errors like l-value errors
    const lvalMatch = cleaned.match(/[\w\s]+[+\-*\/%][\w\s]+=\s*[\w\s]+;/);
    if (lvalMatch) {
        errors.push({ type: 'lvalue_error', msg: `Invalid assignment target: ${lvalMatch[0].trim()}` });
    }

    // Check 6: Truncated code / stray tokens
    // e.g. code ending abruptly without semicolon or brace
    const trimmed = cleaned.trim();
    if (!trimmed.endsWith('}') && !trimmed.endsWith(';') && !trimmed.endsWith('>')) {
        errors.push({ type: 'truncated_code', msg: `Code ends unexpectedly: "${trimmed.slice(-30)}"` });
    }

    // Check 7: Semicolon missing on statements
    // We can do a line-by-line inspection of main body
    const lines = cleaned.split('\n');
    lines.forEach((l, lIdx) => {
        const tr = l.trim();
        if (tr.startsWith('cin >>') && !tr.endsWith(';')) {
            errors.push({ type: 'missing_semicolon', msg: `Line ${lIdx + 1}: cin without semicolon: ${tr}` });
        }
        if (tr.startsWith('cout <<') && !tr.endsWith(';') && !tr.endsWith('{') && !lines[lIdx+1]?.trim().startsWith('<<') && !lines[lIdx+1]?.trim().startsWith('cout')) {
            // Check if next line continues the cout
            if (lIdx + 1 < lines.length && !lines[lIdx+1].trim().endsWith(';')) {
                errors.push({ type: 'incomplete_cout', msg: `Line ${lIdx + 1}: cout incomplete` });
            }
        }
    });

    compileResults.push({
        idx: idx + 1,
        roll,
        gt,
        compiles_raw: errors.length === 0,
        errors,
        raw_code: code,
        cleaned_code: cleaned
    });
});

console.log('=== Syntax / Compilation Audit ===');
const failedRaw = compileResults.filter(r => !r.compiles_raw);
console.log(`Total: ${compileResults.length}`);
console.log(`Compiles raw (estimated clean syntax): ${compileResults.length - failedRaw.length} (${((compileResults.length - failedRaw.length)/46*100).toFixed(1)}%)`);
console.log(`Fails compilation raw: ${failedRaw.length} (${(failedRaw.length/46*100).toFixed(1)}%)`);

console.log('\nBreakdown of raw failures:');
failedRaw.forEach(r => {
    console.log(`[${r.idx}] ${r.roll} (GT: ${r.gt}) -> ${r.errors.map(e => e.type + ': ' + e.msg).join(' | ')}`);
});

fs.writeFileSync('scripts/compile_audit.json', JSON.stringify(compileResults, null, 2));

