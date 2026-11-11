// Test balanced JSON extraction logic
function extractReasoningAndJson(text) {
  const clean = text.trim();
  const cPos = clean.lastIndexOf('"criteria"');
  if (cPos === -1) {
    return { reasoning: clean, jsonStr: "", feedback: "" };
  }

  // Find all balanced JSON objects { ... } containing "criteria"
  // Scan for '{'
  let candidates = [];
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '{') {
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let j = i; j < clean.length; j++) {
        const ch = clean[j];
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === '\\') {
          escape = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) {
              const sub = clean.slice(i, j + 1);
              if (sub.includes('"criteria"')) {
                candidates.push({ start: i, end: j + 1, jsonStr: sub });
              }
              break;
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    return { reasoning: clean, jsonStr: "", feedback: "" };
  }

  // Pick the LAST balanced block containing "criteria"
  const chosen = candidates[candidates.length - 1];
  const reasoning = clean.slice(0, chosen.start).trim();
  const jsonStr = chosen.jsonStr.trim();
  const feedback = clean.slice(chosen.end).trim();

  return { reasoning, jsonStr, feedback };
}

// Test 1: standard 3-step
const t1 = `Let's think step-by-step.
- c1: satisfied. Line 5.
{"criteria": [{"id": "c1", "marks_awarded": 5.0, "comment": "Good", "evidence_lines": [5]}], "needs_human_review": false}
Feedback:
Good job! Keep it up.`;

console.log("Test 1:", extractReasoningAndJson(t1));

// Test 2: multiple JSON blocks (e.g. LLM discussed JSON in reasoning)
const t2 = `Let's think step-by-step.
Earlier schema looked like {"dummy": 123}.
Now for rubric:
{"criteria": [{"id": "c1", "marks_awarded": 5.0, "comment": "Great logic", "evidence_lines": [10]}], "needs_human_review": false}
Feedback:
Excellent work.`;

console.log("Test 2 chosen JSON:", extractReasoningAndJson(t2).jsonStr);
console.log("Test 2 reasoning ends with 'Now for rubric:':", extractReasoningAndJson(t2).reasoning.endsWith("Now for rubric:"));

