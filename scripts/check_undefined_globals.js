const fs = require('fs');

const pyCode = fs.readFileSync('cpp-grader-code/nb1_data.py', 'utf8');

// Find all assigned variables (global or module level)
const assigned = new Set();
const lines = pyCode.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if line assigns to ALL_CAPS
    const m = line.match(/^\s*([A-Z][A-Z0-9_]{2,})\s*(?::[^=]+)?\s*=/);
    if (m) {
        assigned.add(m[1]);
    }
    // Also check imports
    const imp = line.match(/import\s+([A-Za-z0-9_,\s()]+)/);
    if (imp) {
        imp[1].split(',').forEach(s => {
            const token = s.trim().replace(/[()]/g, '').split(/\s+as\s+/).pop().trim();
            if (token) assigned.add(token);
        });
    }
}

// Find all usages of ALL_CAPS
const usageMap = new Map();
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('#')) continue; // skip comments
    const matches = line.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g);
    for (const match of matches) {
        const id = match[1];
        if (!usageMap.has(id)) usageMap.set(id, []);
        usageMap.get(id).push(i + 1);
    }
}

const standardExceptions = new Set([
    'TRUE', 'FALSE', 'NONE', 'HTTP', 'JSON', 'UTF', 'ASCII', 'CPU', 'GPU', 'CUDA',
    'RAM', 'CAND', 'PASS', 'WARN', 'INFO', 'FAIL', 'ERROR', 'LEAKAGE', 'PROG', 'AST',
    'MATH', 'PRINTF', 'SCANF', 'COUT', 'CIN', 'STDLIB', 'IOSTREAM', 'STD', 'MAX', 'MIN',
    'NULL', 'NPOS', 'CONST', 'STATIC', 'VOID', 'INT', 'CHAR', 'FLOAT', 'DOUBLE', 'BOOL',
    'LONG', 'AUTO', 'SIZEOF', 'NEW', 'DELETE', 'TRUE_KW', 'FALSE_KW', 'EOF', 'PREFLIGHT',
    'NOT_MEASURED', 'SMOKE_ONLY', 'KAGGLE_KERNEL_RUN_TYPE', 'CPP_GRADER_ROOT', 'DATA_DIR',
    'BASE_DIR', 'HF_HUB_OFFLINE', 'T4', 'P100', 'V100', 'A100', 'L4', 'NF4', 'SFT',
    'NCA', 'CRE', 'PRE', 'AST', 'QWK', 'MAE', 'FAST', 'NUCES', 'SIGCSE', 'SHA256'
]);

console.log("Analyzing ALL_CAPS usages in nb1_data.py...");
for (const [id, lineNums] of usageMap.entries()) {
    if (!assigned.has(id) && !standardExceptions.has(id)) {
        console.log(`Unassigned identifier: ${id} at lines: ${lineNums.join(', ')}`);
    }
}
