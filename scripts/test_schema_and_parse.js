const fs = require("fs");

// Test schema & parser logic mirroring Python implementation

function stripLineNumber(line) {
  return line.replace(/^\s*\d+\|\s?/, "");
}

const ABSENCE_MARKERS = [
  "missing", "omit", "absent", "lacks", "not found", "fails to",
  "unhandled", "unreadable", "without", "no ", "never", "not present",
  "did not", "does not", "incomplete"
];

function hasAbsenceMarker(comment) {
  const low = comment.toLowerCase();
  return ABSENCE_MARKERS.some(m => low.includes(m));
}

function validateGradingOutput(outputJson, rubric, studentAnswerLineno, executionReport) {
  const errors = [];
  let data;
  try {
    data = JSON.parse(outputJson);
  } catch (e) {
    return [false, [`JSON parse error: ${e.message}`]];
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [false, ["Output is not a JSON object"]];
  }

  for (const key of ["criteria", "needs_human_review"]) {
    if (!(key in data)) errors.push(`Missing key '${key}'`);
  }
  if (errors.length > 0) return [false, errors];

  if (!Array.isArray(data.criteria)) return [false, ["'criteria' must be a list"]];
  if (typeof data.needs_human_review !== "boolean") errors.push("'needs_human_review' must be a boolean");
  if ("total" in data) errors.push("Output must not contain 'total' (sum in code)");

  const rubricMap = {};
  for (const r of rubric) rubricMap[r.id] = r;
  const rubricIds = new Set(Object.keys(rubricMap));
  const outputIds = new Set();

  const answerLines = studentAnswerLineno.split("\n");
  const nLines = answerLines.length;

  for (const crit of data.criteria) {
    if (typeof crit !== "object" || crit === null) {
      errors.push("Criterion is not a dict");
      continue;
    }
    const cid = crit.id;
    if (!cid) {
      errors.push("Criterion missing key 'id'");
      continue;
    }
    if (!rubricIds.has(cid)) {
      errors.push(`Unknown criterion id '${cid}'`);
      continue;
    }
    if (outputIds.has(cid)) {
      errors.push(`Duplicate criterion id '${cid}'`);
      continue;
    }
    outputIds.add(cid);

    const hasMark = ("marks_awarded" in crit) || ("awarded" in crit);
    if (!hasMark) {
      errors.push(`'${cid}': missing key 'awarded' or 'marks_awarded'`);
    }
    const awarded = "marks_awarded" in crit ? crit.marks_awarded : crit.awarded;
    crit.awarded = awarded;
    crit.marks_awarded = awarded;

    const maxM = rubricMap[cid].max_marks;
    const awardedIsNum = typeof awarded === "number" && !isNaN(awarded);
    if (!awardedIsNum) {
      errors.push(`'${cid}': awarded mark not a valid number`);
    } else {
      if (awarded < 0 || awarded > maxM) {
        errors.push(`'${cid}': awarded ${awarded} not in [0, ${maxM}]`);
      }
      if ((awarded * 2) % 1 !== 0) {
        errors.push(`'${cid}': awarded ${awarded} not in 0.5 increments`);
      }
    }

    const hasComment = ("justification" in crit) || ("comment" in crit);
    if (!hasComment) {
      errors.push(`'${cid}': missing key 'comment' or 'justification'`);
    }
    const comment = "justification" in crit ? crit.justification : crit.comment;
    crit.comment = comment;
    crit.justification = comment;

    if (typeof comment !== "string" || !comment.trim()) {
      errors.push(`'${cid}': comment must be non-empty`);
    } else if (comment.trim().split(/\s+/).length < 3) {
      errors.push(`'${cid}': comment must be a substantive explanation (>= 3 words)`);
    }

    if (!("evidence_lines" in crit)) {
      errors.push(`'${cid}': missing key 'evidence_lines'`);
    } else {
      const evLines = crit.evidence_lines;
      if (!Array.isArray(evLines)) {
        errors.push(`'${cid}': evidence_lines must be a list`);
      } else {
        for (const ln of evLines) {
          if (!Number.isInteger(ln)) {
            errors.push(`'${cid}': evidence_lines must contain integers, got ${ln}`);
          } else if (ln < 1 || ln > nLines) {
            errors.push(`'${cid}': line ${ln} out of range [1, ${nLines}]`);
          } else if (!stripLineNumber(answerLines[ln - 1]).trim()) {
            errors.push(`'${cid}': cited evidence line ${ln} is empty/blank`);
          }
        }
      }
    }
  }

  for (const rid of rubricIds) {
    if (!outputIds.has(rid)) errors.push(`Missing criterion: ${rid}`);
  }

  return [errors.length === 0, errors];
}

// Test cases
const rubric = [
  { id: "c1", description: "Loop construct", max_marks: 4.0 },
  { id: "c2", description: "Output format", max_marks: 3.0 }
];
const studentCode = "1| int main() {\n2|   for(int i=0; i<10; i++) cout << i;\n3| }";

// Test A: Out-of-range mark (should fail, out_of_range_count = 1, NOT clamped)
const outOfRangeJson = JSON.stringify({
  criteria: [
    { id: "c1", marks_awarded: 5.5, justification: "Great loop implementation", evidence_lines: [2] },
    { id: "c2", marks_awarded: 3.0, justification: "Correct output logic", evidence_lines: [2] }
  ],
  needs_human_review: false
});
const [validA, errorsA] = validateGradingOutput(outOfRangeJson, rubric, studentCode);
console.log("Test A (Out of range 5.5 in max 4.0) valid:", validA, "errors:", errorsA);

// Test B: Dual field support (marks_awarded + justification)
const validCustomJson = JSON.stringify({
  criteria: [
    { id: "c1", marks_awarded: 4.0, justification: "Great loop implementation", evidence_lines: [2] },
    { id: "c2", awarded: 3.0, comment: "Correct output logic", evidence_lines: [2] }
  ],
  needs_human_review: false
});
const [validB, errorsB] = validateGradingOutput(validCustomJson, rubric, studentCode);
console.log("Test B (marks_awarded + justification dual support) valid:", validB, "errors:", errorsB);

console.log("ALL TESTS COMPLETED.");

