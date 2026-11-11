const fs = require("fs");
const path = require("path");
const readline = require("readline");

const logPath = path.join(process.env.USERPROFILE, ".gemini", "antigravity", "brain", "e0b8d225-9ce7-49b6-9bf9-8bde36465e2a", ".system_generated", "logs", "transcript_full.jsonl");

const rl = readline.createInterface({
  input: fs.createReadStream(logPath)
});

rl.on("line", (line) => {
  try {
    const data = JSON.parse(line);
    if (data.step_index === 49) {
      fs.writeFileSync("scripts/full_prompt_49.txt", data.content, "utf8");
      console.log("Wrote full_prompt_49.txt, length:", data.content.length);
      process.exit(0);
    }
  } catch (e) {}
});
