const fs = require("fs");
const path = require("path");

function countFiles(dir) {
  let count = 0;
  if (!fs.existsSync(dir)) return 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else if (entry.name.endsWith(".c") || entry.name.endsWith(".cpp")) {
      count++;
    }
  }
  return count;
}

console.log("C-Pack C/C++ files:", countFiles("repos/C-Pack-IPAs"));
console.log("ITSP C/C++ files:", countFiles("repos/ITSP"));
console.log("IntroClass C/C++ files:", countFiles("repos/IntroClass"));

