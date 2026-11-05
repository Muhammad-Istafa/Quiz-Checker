const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');

// Load split files from cpp-grader-data-v1-1
const splits = ['train', 'val', 'test_seen', 'test_unseen'];

function normalizeCode(code) {
    // Remove comments
    let c = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    // Normalize whitespace
    c = c.replace(/\s+/g, ' ').trim();
    // Normalize identifiers (optional: or exact normalized string)
    return c;
}

function hashNorm(code) {
    return crypto.createHash('sha256').update(normalizeCode(code)).digest('hex');
}

async function runLeakageCheck() {
    const splitHashes = {};
    const splitPrograms = {};
    const splitRecords = {};

    for (const split of splits) {
        const filePath = `cpp-grader-data-v1-1/${split}.jsonl`;
        if (!fs.existsSync(filePath)) continue;

        splitHashes[split] = new Set();
        splitPrograms[split] = new Set();
        splitRecords[split] = 0;

        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        for await (const line of rl) {
            if (!line.trim()) continue;
            splitRecords[split]++;
            const rec = JSON.parse(line);
            const code = rec.student_answer_raw || rec.student_answer || '';
            const h = hashNorm(code);
            splitHashes[split].add(h);
            if (rec.program_id) splitPrograms[split].add(rec.program_id);
        }
        console.log(`Split ${split}: ${splitRecords[split]} records, ${splitHashes[split].size} unique code hashes, ${splitPrograms[split].size} programs`);
    }

    console.log('\n--- Cross-split exact normalized code overlaps ---');
    for (let i = 0; i < splits.length; i++) {
        for (let j = i + 1; j < splits.length; j++) {
            const s1 = splits[i];
            const s2 = splits[j];
            if (!splitHashes[s1] || !splitHashes[s2]) continue;

            const intersection = [...splitHashes[s1]].filter(x => splitHashes[s2].has(x));
            console.log(`${s1} vs ${s2}: ${intersection.length} overlapping code hashes`);
        }
    }

    console.log('\n--- Cross-split program_id overlaps ---');
    for (let i = 0; i < splits.length; i++) {
        for (let j = i + 1; j < splits.length; j++) {
            const s1 = splits[i];
            const s2 = splits[j];
            if (!splitPrograms[s1] || !splitPrograms[s2]) continue;

            const intersection = [...splitPrograms[s1]].filter(x => splitPrograms[s2].has(x));
            console.log(`${s1} vs ${s2}: ${intersection.length} overlapping program_ids`);
        }
    }
}

runLeakageCheck();

