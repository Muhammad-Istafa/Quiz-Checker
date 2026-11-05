const fs = require('fs');

const students = JSON.parse(fs.readFileSync('quiz3_raw/quiz3_students.json', 'utf8'));
const preds = fs.readFileSync('nb3_output1_extracted/output/real/predictions/FT-4B_real.jsonl', 'utf8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => JSON.parse(l));

// Create map of preds by sample_id
const predMap = {};
preds.forEach(p => {
    predMap[p.sample_id] = p;
});

const correct = students.filter(s => s.gt >= 6.99);

const forensics = correct.map((s, idx) => {
    const sid = `real_q3_${s.rollNo}`;
    const p = predMap[sid];
    return {
        rollNo: s.rollNo,
        gt: s.gt,
        predTotal: p?.parsed?.total,
        predRawTotal: p?.raw_parsed ? p.raw_parsed.criteria.reduce((a, c) => a + (c.awarded || 0), 0) : null,
        schemaValid: p?.schema_valid_final,
        criteria: p?.parsed?.criteria || [],
        rawOutput: p?.raw_output,
        studentCode: s.solution
    };
});

fs.writeFileSync('scripts/forensics_10_correct.json', JSON.stringify(forensics, null, 2));

console.log('Forensics for 10 correct students:');
forensics.forEach((f, idx) => {
    console.log(`\n--- [${idx + 1}] Roll: ${f.rollNo}, GT: ${f.gt}, Pred: ${f.predTotal} ---`);
    if (f.criteria) {
        f.criteria.forEach(c => {
            console.log(`  ${c.id}: ${c.awarded} | Ev: ${JSON.stringify(c.evidence_lines)} | ${c.comment}`);
        });
    }
});

