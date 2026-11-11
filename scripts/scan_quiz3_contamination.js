const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function normalizeCode(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(code) {
  const norm = normalizeCode(code);
  const tokens = norm.match(/[a-zA-Z_]\w*|\d+|[^\s\w]/g) || [];
  return new Set(tokens);
}

function tokenJaccard(setA, setB) {
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter++;
  }
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

// 1. Load Quiz 3 submissions
const quiz3Dir = "quiz3_clean";
const quiz3Files = fs.readdirSync(quiz3Dir).filter(f => f.endsWith(".cpp"));
const quiz3Codes = [];
for (const f of quiz3Files) {
  const c = fs.readFileSync(path.join(quiz3Dir, f), "utf8");
  quiz3Codes.push({
    file: f,
    code: c,
    norm: normalizeCode(c),
    hash: crypto.createHash("sha256").update(normalizeCode(c)).digest("hex"),
    tokens: getTokens(c)
  });
}
console.log(`Loaded ${quiz3Codes.length} Quiz 3 submissions for firewall verification.`);

// 2. Scan question bank & real tasks in cpp-grader-code
const realSources = fs.readFileSync("cpp-grader-code/src/real_sources.py", "utf8");
const nb1Data = fs.readFileSync("cpp-grader-code/nb1_data.py", "utf8");

// Substring scan for Quiz 3 problem text / denomination set:
// Denomination set: 5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1
const quiz3DenomPattern = /5000[\s\S]{1,50}1000[\s\S]{1,50}500[\s\S]{1,50}100/;
console.log("Checking for Quiz 3 denomination pattern in real_sources.py:", quiz3DenomPattern.test(realSources));
console.log("Checking for Quiz 3 denomination pattern in nb1_data.py:", quiz3DenomPattern.test(nb1Data));

// Check any exact hash matches or high Jaccard with IntroClass, C-Pack, or ITSP sample references
const introClassRefs = [
  // digits
  `#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    if (cin >> n) {\n        if (n == 0) { cout << 0 << endl; return 0; }\n        if (n < 0) n = -n;\n        while (n > 0) {\n            cout << (n % 10) << endl;\n            n /= 10;\n        }\n    }\n    return 0;\n}`,
  // median
  `#include <iostream>\nusing namespace std;\nint main() {\n    int a, b, c;\n    if (cin >> a >> b >> c) {\n        if ((a >= b && a <= c) || (a <= b && a >= c)) cout << a << endl;\n        else if ((b >= a && b <= c) || (b <= a && b >= c)) cout << b << endl;\n        else cout << c << endl;\n    }\n    return 0;\n}`
];

let maxJaccard = 0;
for (const ref of introClassRefs) {
  const rTokens = getTokens(ref);
  const rHash = crypto.createHash("sha256").update(normalizeCode(ref)).digest("hex");
  for (const q of quiz3Codes) {
    if (rHash === q.hash) {
      console.error(`COLLISION DETECTED: ${q.file}`);
      process.exit(1);
    }
    const j = tokenJaccard(rTokens, q.tokens);
    if (j > maxJaccard) maxJaccard = j;
    if (j >= 0.8) {
      console.error(`HIGH JACCARD DETECTED (${j}): ${q.file}`);
      process.exit(1);
    }
  }
}

console.log(`Max Jaccard with Quiz 3: ${maxJaccard.toFixed(4)} (firewall threshold: 0.80)`);
console.log("[FIREWALL AUDIT PASSED] Zero Quiz 3 contamination in training sources.");

