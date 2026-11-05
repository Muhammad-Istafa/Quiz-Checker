// Verification of test_per_criterion_fix in Node.js
function criterion_hits(record) {
    const gold_criteria = record.gold_criteria || [];
    if (!gold_criteria.length) {
        return [0, 0];
    }
    const gold_map = {};
    gold_criteria.forEach(c => {
        gold_map[String(c.id).trim().toLowerCase()] = Number(c.awarded);
    });

    if (!(record.schema_valid_final && record.parsed)) {
        return [0, Object.keys(gold_map).length];
    }

    const parsed = record.parsed;
    const pred_criteria = Array.isArray(parsed.criteria) ? parsed.criteria : [];
    const pred_map = {};
    pred_criteria.forEach(c => {
        if (c && typeof c === 'object') {
            pred_map[String(c.id).trim().toLowerCase()] = Number(c.awarded || 0);
        }
    });

    let ok = 0;
    for (const [cid, g] of Object.entries(gold_map)) {
        if (cid in pred_map && Math.abs(pred_map[cid] - g) < 0.01) {
            ok++;
        }
    }
    return [ok, Object.keys(gold_map).length];
}

function compute_criterion_accuracy(records) {
    let ok = 0;
    let tot = 0;
    for (const r of records) {
        const [a, b] = criterion_hits(r);
        ok += a;
        tot += b;
    }
    if (tot === 0) return NaN;
    return ok / tot;
}

// Test 1: Synthetic
const synth_rec = {
    sample_id: "synth_1",
    schema_valid_final: true,
    gold_criteria: [
        { id: "fib_init", awarded: 1.0 },
        { id: "fib_loop", awarded: 1.5 },
        { id: "fib_recur", awarded: 1.5 },
    ],
    parsed: {
        criteria: [
            { id: "fib_init", awarded: 1.0 },
            { id: "fib_loop", awarded: 1.5 },
            { id: "fib_recur", awarded: 1.0 },
        ]
    }
};
const [h1, t1] = criterion_hits(synth_rec);
if (h1 !== 2 || t1 !== 3) throw new Error("Synth hits failed");
const acc1 = compute_criterion_accuracy([synth_rec]);
if (Math.abs(acc1 - 2/3) > 1e-4) throw new Error("Synth acc failed");
console.log("[PASS] Node: test_synthetic_record");

// Test 2: Real record
const real_rec = {
    sample_id: "real_q3_25F-0518",
    schema_valid_final: true,
    gold_total: 7.0,
    gold_criteria: [],
    parsed: {
        total: 7.0,
        criteria: [
            { id: "q3_c1", awarded: 1.0 },
            { id: "q3_c2", awarded: 3.0 },
            { id: "q3_c3", awarded: 1.0 },
            { id: "q3_c4", awarded: 2.0 },
        ]
    }
};
const [h2, t2] = criterion_hits(real_rec);
if (h2 !== 0 || t2 !== 0) throw new Error("Real hits should be [0, 0]");
const acc2 = compute_criterion_accuracy([real_rec]);
if (!Number.isNaN(acc2)) throw new Error("Real acc should be NaN, got: " + acc2);
console.log("[PASS] Node: test_real_record (returns NaN, not 0.0%)");

// Test 3: Mixed
const acc3 = compute_criterion_accuracy([synth_rec, real_rec]);
if (Math.abs(acc3 - 2/3) > 1e-4) throw new Error("Mixed acc failed");
console.log("[PASS] Node: test_mixed_records");
console.log("[ALL PASS] All per-criterion unit tests verified successfully.");

