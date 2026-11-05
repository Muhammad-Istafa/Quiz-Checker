const fs = require('fs');

const students = JSON.parse(fs.readFileSync('quiz3_raw/quiz3_students.json', 'utf8'));

console.log(`Analyzing ${students.length} submissions...`);

const results = [];

students.forEach((s, idx) => {
    const code = s.solution;
    const lines = code.split('\n');
    
    // Check for junk prefix before #include or main
    let headerJunkLines = 0;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('#include') || trimmed.startsWith('using namespace') || trimmed.startsWith('int main')) {
            break;
        }
        if (trimmed.length > 0) {
            headerJunkLines++;
        }
    }

    // Check basic syntax indicators
    const hasInclude = /#\s*include\s*<iostream>/.test(code);
    const hasMain = /(int|void)\s+main\s*\(/.test(code);
    
    // Count braces
    let openBraces = (code.match(/{/g) || []).length;
    let closeBraces = (code.match(/}/g) || []).length;

    // Check obvious syntax flaws
    const issues = [];
    if (headerJunkLines > 0) issues.push(`Header junk (${headerJunkLines} non-code lines at start)`);
    if (!hasInclude) issues.push('Missing #include <iostream>');
    if (!hasMain) issues.push('Missing main function');
    if (openBraces !== closeBraces) issues.push(`Unbalanced braces: ${openBraces} open vs ${closeBraces} close`);

    results.push({
        idx: idx + 1,
        roll: s.rollNo,
        gt: s.gt,
        headerJunkLines,
        hasInclude,
        hasMain,
        openBraces,
        closeBraces,
        issues,
        firstLine: lines[0]?.substring(0, 50),
        codeLength: code.length
    });
});

console.log(JSON.stringify(results, null, 2));

