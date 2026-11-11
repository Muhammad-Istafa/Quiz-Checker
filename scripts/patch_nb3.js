const fs = require("fs");

const nbPath = "notebooks/nb3_infer.ipynb";
const nb = JSON.parse(fs.readFileSync(nbPath, "utf8"));

// Read current canonical prompts and schema from cpp-grader-code/src
const canonicalSchema = fs.readFileSync("cpp-grader-code/src/schema.py", "utf8");
const canonicalPrompts = fs.readFileSync("cpp-grader-code/src/prompts.py", "utf8");

// 1. Update cell 0C-bis fallback strings
for (const cell of nb.cells) {
  if (cell.source && cell.source.some(line => line.includes("0C-bis. SHARED CODE"))) {
    // Replace _CANONICAL_SCHEMA and _CANONICAL_PROMPTS
    let text = cell.source.join("");
    // Replace _CANONICAL_SCHEMA
    const sStart = text.indexOf("_CANONICAL_SCHEMA = r'''");
    const sEnd = text.indexOf("'''\n", sStart);
    if (sStart !== -1 && sEnd !== -1) {
      text = text.slice(0, sStart) + "_CANONICAL_SCHEMA = " + JSON.stringify(canonicalSchema) + "\n\n" + text.slice(sEnd + 4);
    }
    // Replace _CANONICAL_PROMPTS
    const pStart = text.indexOf("_CANONICAL_PROMPTS = r'''");
    const pEnd = text.indexOf("'''\n", pStart);
    if (pStart !== -1 && pEnd !== -1) {
      text = text.slice(0, pStart) + "_CANONICAL_PROMPTS = " + JSON.stringify(canonicalPrompts) + "\n\n" + text.slice(pEnd + 4);
    }
    cell.source = text.split("\n").map((l, i, arr) => i < arr.length - 1 ? l + "\n" : l);
  }
}

// 2. Ensure InferConfig has default eval_arm and adapter_path, and asserts them
for (const cell of nb.cells) {
  if (cell.source && cell.source.some(line => line.includes("class InferConfig:"))) {
    let src = cell.source.join("");
    if (!src.includes("eval_arm:")) {
      src = src.replace("class InferConfig:\n", "class InferConfig:\n    eval_arm: str = field(default_factory=lambda: os.environ.get('EVAL_ARM', 'A2'))\n    adapter_path: str = field(default_factory=lambda: os.environ.get('ADAPTER_PATH', '/kaggle/working/output/best_adapter'))\n");
      cell.source = src.split("\n").map((l, i, arr) => i < arr.length - 1 ? l + "\n" : l);
    }
  }
}

// 3. Ensure eval_arm and adapter_path are stamped into all output records and CSVs
for (const cell of nb.cells) {
  if (cell.source && cell.source.some(line => line.includes("Graded_Quiz_Results.xlsx"))) {
    let src = cell.source.join("");
    if (!src.includes('"eval_arm": CFG.eval_arm')) {
      src = src.replace(
        '"Roll No":',
        '"eval_arm": CFG.eval_arm,\n                "adapter_path": CFG.adapter_path,\n                "Roll No":'
      );
      src = src.replace(
        'real_metrics["B_exec_quiz3"]',
        'real_metrics["eval_arm"] = CFG.eval_arm\n    real_metrics["adapter_path"] = CFG.adapter_path\n    real_metrics["B_exec_quiz3"]'
      );
      cell.source = src.split("\n").map((l, i, arr) => i < arr.length - 1 ? l + "\n" : l);
    }
  }
  if (cell.source && cell.source.some(line => line.includes('pred_dir, f"{key}.jsonl"'))) {
    let src = cell.source.join("");
    if (!src.includes('r["eval_arm"] = CFG.eval_arm')) {
      src = src.replace(
        'for r in res:\n',
        'for r in res:\n            r["eval_arm"] = CFG.eval_arm\n            r["adapter_path"] = CFG.adapter_path\n'
      );
      cell.source = src.split("\n").map((l, i, arr) => i < arr.length - 1 ? l + "\n" : l);
    }
  }
}

fs.writeFileSync(nbPath, JSON.stringify(nb, null, 1), "utf8");
console.log("Successfully patched notebooks/nb3_infer.ipynb with Bug Fixes 1, 2, 3");

