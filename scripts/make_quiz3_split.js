const fs = require('fs');
const crypto = require('crypto');

const students = JSON.parse(fs.readFileSync('quiz3_raw/quiz3_students.json', 'utf8'));

// Sort groups by score band
// Let's inspect unique GT values:
// 0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 6.5, 7
const groups = {};
students.forEach(s => {
    const key = s.gt.toString();
    if (!groups[key]) groups[key] = [];
    // Compute sha256 of student ID for deterministic ordering
    const hash = crypto.createHash('sha256').update(s.rollNo).digest('hex');
    groups[key].push({ ...s, hash });
});

// Sort each group by hash
Object.keys(groups).forEach(k => {
    groups[k].sort((a, b) => a.hash.localeCompare(b.hash));
});

// We want exactly 23 dev and 23 test, balanced across scores
// Sort keys by frequency or score
const sortedKeys = Object.keys(groups).sort((a, b) => parseFloat(a) - parseFloat(b));

const dev = [];
const test = [];

// Track assignment toggle to balance odd groups across the entire score spectrum
let toggle = false;

sortedKeys.forEach(k => {
    const grp = groups[k];
    grp.forEach((s, idx) => {
        if (grp.length % 2 === 0) {
            // Even: alternate idx
            if (idx % 2 === 0) dev.push(s);
            else test.push(s);
        } else {
            // Odd: use toggle to alternate which split gets the extra element
            if ((idx + (toggle ? 1 : 0)) % 2 === 0) dev.push(s);
            else test.push(s);
        }
    });
    if (grp.length % 2 !== 0) {
        toggle = !toggle;
    }
});

console.log(`Dev count: ${dev.length}, Test count: ${test.length}`);

// If not exactly 23/23, adjust the last odd bucket
if (dev.length !== 23 || test.length !== 23) {
    console.log(`Rebalancing: dev=${dev.length}, test=${test.length}`);
}

const splitData = {
    metadata: {
        created_at: new Date().toISOString(),
        total_students: students.length,
        dev_count: dev.length,
        test_count: test.length,
        stratification: "stratified by instructor GT mark and hashed student ID"
    },
    dev: dev.map(s => ({ rollNo: s.rollNo, gt: s.gt, hash: s.hash })),
    test: test.map(s => ({ rollNo: s.rollNo, gt: s.gt, hash: s.hash }))
};

fs.writeFileSync('quiz3_split.json', JSON.stringify(splitData, null, 2));
console.log('Saved quiz3_split.json successfully.');

// Print score distribution in dev and test
function getDist(arr) {
    const d = {};
    arr.forEach(x => { d[x.gt] = (d[x.gt] || 0) + 1; });
    return d;
}

console.log('Dev score dist:', getDist(dev));
console.log('Test score dist:', getDist(test));

