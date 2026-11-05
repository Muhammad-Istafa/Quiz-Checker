const fs = require('fs');
const path = require('path');
const { parser } = require('@lezer/python');

function checkPythonSyntax(code, filename) {
    const tree = parser.parse(code);
    const errors = [];
    const lines = code.split('\n');

    tree.iterate({
        enter(node) {
            if (node.type.isError) {
                // Find line number and column
                let charCount = 0;
                let lineNo = 1;
                let colNo = 1;
                for (let i = 0; i < lines.length; i++) {
                    const lineLen = lines[i].length + 1; // +1 for newline
                    if (charCount + lineLen > node.from) {
                        lineNo = i + 1;
                        colNo = node.from - charCount + 1;
                        break;
                    }
                    charCount += lineLen;
                }
                const errorSnippet = code.slice(Math.max(0, node.from - 20), Math.min(code.length, node.to + 20)).replace(/\n/g, ' ');
                errors.push({
                    line: lineNo,
                    col: colNo,
                    from: node.from,
                    to: node.to,
                    snippet: errorSnippet
                });
            }
        }
    });

    return errors;
}

// Test on all py files in cpp-grader-code
const filesToTest = [
    'cpp-grader-code/src/__init__.py',
    'cpp-grader-code/src/schema.py',
    'cpp-grader-code/src/prompts.py',
    'cpp-grader-code/src/paths.py',
    'cpp-grader-code/src/references.py',
    'cpp-grader-code/src/mutations.py',
    'cpp-grader-code/src/trace_builder.py',
    'cpp-grader-code/src/real_sources.py',
    'cpp-grader-code/src/exec_harness.py',
    'cpp-grader-code/src/parse.py',
    'cpp-grader-code/n0_audit.py',
    'cpp-grader-code/nb1_data.py',
    'scripts/run_real_exec.py',
    'tests/test_per_criterion_fix.py'
];

console.log('=== Checking Python files ===');
let hasErrors = false;
for (const file of filesToTest) {
    if (!fs.existsSync(file)) {
        console.log(`[SKIP] ${file} does not exist`);
        continue;
    }
    const code = fs.readFileSync(file, 'utf8');
    const errors = checkPythonSyntax(code, file);
    if (errors.length === 0) {
        console.log(`[PASS] ${file}`);
    } else {
        hasErrors = true;
        console.log(`[FAIL] ${file} has ${errors.length} syntax error(s):`);
        errors.slice(0, 5).forEach(e => console.log(`  Line ${e.line}:${e.col} near "${e.snippet}"`));
    }
}

// Test notebooks code cells
const notebooksToTest = [
    'notebooks/n0_audit.ipynb',
    'notebooks/nb1_data.ipynb',
    'notebooks/nb1b_teacher.ipynb',
    'notebooks/nb2_train.ipynb',
    'notebooks/nb2b_nca.ipynb',
    'notebooks/nb3_infer.ipynb'
];

console.log('\n=== Checking Notebooks code cells ===');
for (const nbFile of notebooksToTest) {
    if (!fs.existsSync(nbFile)) {
        console.log(`[SKIP] ${nbFile} does not exist`);
        continue;
    }
    const nb = JSON.parse(fs.readFileSync(nbFile, 'utf8'));
    let nbErrors = 0;
    nb.cells.forEach((cell, idx) => {
        if (cell.cell_type === 'code') {
            const rawSrc = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
            // Strip IPython magics like !pip or %load_ext for python parsing
            const cleanSrc = rawSrc.split('\n').map(l => {
                const trimmed = l.trim();
                if (trimmed.startsWith('!') || trimmed.startsWith('%')) {
                    return '# magic: ' + l;
                }
                return l;
            }).join('\n');
            const errs = checkPythonSyntax(cleanSrc, `${nbFile} [Cell ${idx}]`);
            if (errs.length > 0) {
                nbErrors += errs.length;
                console.log(`[FAIL] ${nbFile} Cell ${idx} has ${errs.length} syntax error(s):`);
                errs.slice(0, 3).forEach(e => console.log(`  Line ${e.line}:${e.col} near "${e.snippet}"`));
            }
        }
    });
    if (nbErrors === 0) {
        console.log(`[PASS] ${nbFile}`);
    } else {
        hasErrors = true;
    }
}

