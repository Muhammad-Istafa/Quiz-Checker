const fs = require("fs");
const path = require("path");

function normalizeCode(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function checkIntroclassDigits(code) {
  const lines = code.split("\n");
  if (lines.length < 3) return null; // Exclude empty/trivial

  let inLine = null, extLine = null, outLine = null, loopLine = null;
  let hasMod = false, hasDiv = false;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!inLine && (l.includes("cin") || l.includes("scanf"))) inLine = i + 1;
    if (l.includes("%")) { hasMod = true; if (!extLine) extLine = i + 1; }
    if (l.includes("/")) { hasDiv = true; if (!extLine) extLine = i + 1; }
    if (!outLine && (l.includes("cout") || l.includes("printf") || l.includes("putchar"))) outLine = i + 1;
    if (!loopLine && (l.includes("while") || l.includes("for") || l.includes("do"))) loopLine = i + 1;
  }

  // Must have at least basic programming tokens
  if (!inLine && !outLine && !loopLine) return null; // Exclude unparseable junk

  const criteria = [];
  // 1. digits_input (2.0)
  if (inLine) {
    criteria.push({ id: "digits_input", awarded: 2.0, comment: "Reads integer input into variable.", evidence_lines: [inLine] });
  } else {
    criteria.push({ id: "digits_input", awarded: 0.0, comment: "Lacks explicit input reading from stdin.", evidence_lines: [] });
  }

  // 2. digits_extraction (4.0)
  if (hasMod && hasDiv) {
    criteria.push({ id: "digits_extraction", awarded: 4.0, comment: "Extracts digits using modulo (%) and division (/) arithmetic.", evidence_lines: [extLine] });
  } else if (hasMod || hasDiv) {
    criteria.push({ id: "digits_extraction", awarded: 2.0, comment: "Partially extracts digits; missing either modulo or division operation.", evidence_lines: [extLine || 1] });
  } else {
    criteria.push({ id: "digits_extraction", awarded: 0.0, comment: "Fails to extract digits arithmetic operations.", evidence_lines: [] });
  }

  // 3. digits_display (2.0)
  if (outLine) {
    criteria.push({ id: "digits_display", awarded: 2.0, comment: "Outputs digits sequentially.", evidence_lines: [outLine] });
  } else {
    criteria.push({ id: "digits_display", awarded: 0.0, comment: "Omitted digit output display.", evidence_lines: [] });
  }

  // 4. digits_flow (2.0)
  if (loopLine) {
    criteria.push({ id: "digits_flow", awarded: 2.0, comment: "Loop construct handles iteration and termination properly.", evidence_lines: [loopLine] });
  } else {
    criteria.push({ id: "digits_flow", awarded: 0.0, comment: "Missing loop construct to iterate across digits.", evidence_lines: [] });
  }

  return criteria;
}

// Test on IntroClass digits
const introDigitsDir = path.join("repos", "IntroClass", "digits");
let accepted = 0;
let excluded = 0;
let scoreDist = {};

if (fs.existsSync(introDigitsDir)) {
  const users = fs.readdirSync(introDigitsDir);
  for (const u of users) {
    const uDir = path.join(introDigitsDir, u);
    if (!fs.statSync(uDir).isDirectory()) continue;
    const vers = fs.readdirSync(uDir);
    for (const v of vers) {
      const vDir = path.join(uDir, v);
      if (!fs.statSync(vDir).isDirectory()) continue;
      const cFiles = fs.readdirSync(vDir).filter(f => f.endsWith(".c"));
      for (const cf of cFiles) {
        const code = fs.readFileSync(path.join(vDir, cf), "utf8");
        const res = checkIntroclassDigits(code);
        if (!res) {
          excluded++;
        } else {
          accepted++;
          const tot = res.reduce((a, b) => a + b.awarded, 0);
          scoreDist[tot] = (scoreDist[tot] || 0) + 1;
        }
      }
    }
  }
}

console.log(`[TEST CHECKERS] IntroClass digits: Accepted=${accepted}, Excluded=${excluded}`);
console.log(`[TEST CHECKERS] Score distribution:`, scoreDist);

// Test C-Pack-IPAs
const cpackDir = path.join("repos", "C-Pack-IPAs");
let cpackAccepted = 0, cpackExcluded = 0;
let cpackScores = {};

function checkCpackLab02(code, isSyntaxBroken) {
  const lines = code.split("\n");
  if (lines.length < 3) return null;
  let inLine = null, outLine = null, branchLine = null;
  let hasPos = false, hasNeg = false, hasZero = false;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!inLine && (l.includes("cin") || l.includes("scanf"))) inLine = i + 1;
    if (l.includes("> 0") || l.includes(">= 1") || l.includes("positive")) { hasPos = true; if (!branchLine) branchLine = i + 1; }
    if (l.includes("< 0") || l.includes("<= -1") || l.includes("negative")) { hasNeg = true; if (!branchLine) branchLine = i + 1; }
    if (l.includes("== 0") || l.includes("zero") || l.includes("else")) { hasZero = true; if (!branchLine) branchLine = i + 1; }
    if (!outLine && (l.includes("cout") || l.includes("printf"))) outLine = i + 1;
  }

  if (!inLine && !outLine && !branchLine) return null; // Exclude unparseable junk

  const criteria = [];
  criteria.push({
    id: "cpack_l2_input",
    awarded: inLine ? 2.0 : 0.0,
    comment: inLine ? "Reads integer input." : "Missing input reading.",
    evidence_lines: inLine ? [inLine] : []
  });

  let branchMarks = 0.0;
  if (hasPos && hasNeg && hasZero) branchMarks = 5.0;
  else if (hasPos && hasNeg) branchMarks = 3.5;
  else if (hasPos || hasNeg) branchMarks = 2.0;

  criteria.push({
    id: "cpack_l2_branch",
    awarded: branchMarks,
    comment: branchMarks === 5.0 ? "Checks positive, negative, and zero conditions." : "Incomplete classification branches.",
    evidence_lines: branchLine ? [branchLine] : []
  });

  criteria.push({
    id: "cpack_l2_output",
    awarded: outLine ? 3.0 : 0.0,
    comment: outLine ? "Outputs classification message." : "Missing output.",
    evidence_lines: outLine ? [outLine] : []
  });

  return criteria;
}

if (fs.existsSync(cpackDir)) {
  const subdirs = ["correct_submissions", "semantically_incorrect_submissions", "syntactically_incorrect_submissions"];
  for (const s of subdirs) {
    const sDir = path.join(cpackDir, s);
    if (!fs.existsSync(sDir)) continue;
    const files = fs.readdirSync(sDir).filter(f => f.toLowerCase().includes("lab02") && f.endsWith(".c"));
    for (const f of files) {
      const code = fs.readFileSync(path.join(sDir, f), "utf8");
      const res = checkCpackLab02(code, s.includes("syntax"));
      if (!res) cpackExcluded++;
      else {
        cpackAccepted++;
        const tot = res.reduce((a, b) => a + b.awarded, 0);
        cpackScores[tot] = (cpackScores[tot] || 0) + 1;
      }
    }
  }
}
console.log(`[TEST CHECKERS] C-Pack Lab02: Accepted=${cpackAccepted}, Excluded=${cpackExcluded}`);
console.log(`[TEST CHECKERS] Score distribution:`, cpackScores);
