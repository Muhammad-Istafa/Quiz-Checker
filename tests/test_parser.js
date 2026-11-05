const assert = require('assert');

// Test balanced brace extraction
function extractJsonBalanced(clean) {
    const crit_idx = clean.indexOf('"criteria"');
    if (crit_idx === -1) return null;
    const start_brace = clean.lastIndexOf('{', crit_idx);
    if (start_brace === -1) return null;

    let depth = 0;
    let in_str = false;
    let esc = false;
    let end_brace = -1;

    for (let i = start_brace; i < clean.length; i++) {
        const ch = clean[i];
        if (esc) {
            esc = false;
            continue;
        }
        if (ch === '\\') {
            esc = true;
            continue;
        }
        if (ch === '"') {
            in_str = !in_str;
            continue;
        }
        if (!in_str) {
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    end_brace = i + 1;
                    break;
                }
            }
        }
    }
    return end_brace !== -1 ? clean.slice(start_brace, end_brace) : null;
}

// 1. Test when reasoning contains braces
const modelOutputWithBracesInReasoning = `Let's think step-by-step.
- q3_c1: The student initialized while (n > 0) { int rem = n % 10; }. Lines: 5.
- q3_c2: Correct logic.
{"criteria":[{"id":"q3_c1","awarded":1.0,"comment":"Valid logic","evidence_lines":[5]},{"id":"q3_c2","awarded":3.0,"comment":"Sound computation","evidence_lines":[6]}],"needs_human_review":false}

Feedback:
Great job on implementing the loop!`;

const extracted = extractJsonBalanced(modelOutputWithBracesInReasoning);
assert(extracted !== null, "Failed to extract JSON");
const parsed = JSON.parse(extracted);
assert.strictEqual(parsed.criteria.length, 2);
assert.strictEqual(parsed.criteria[0].id, "q3_c1");
assert.strictEqual(parsed.needs_human_review, false);
console.log("[PASS] Balanced JSON extraction with braces in reasoning");

// 2. Test markdown fence extraction
const fencedOutput = `Let's think step-by-step.
\`\`\`json
{"criteria":[{"id":"q3_c1","awarded":1.0,"comment":"Valid logic","evidence_lines":[5]}],"needs_human_review":false}
\`\`\``;

let clean = fencedOutput.trim();
if (clean.includes("```json")) {
    clean = clean.split("```json").pop().split("```")[0].trim();
}
const extractedFenced = extractJsonBalanced(clean);
const parsedFenced = JSON.parse(extractedFenced);
assert.strictEqual(parsedFenced.criteria[0].id, "q3_c1");
console.log("[PASS] Fenced JSON extraction");

console.log("[ALL PASS] Parser logic verified!");

