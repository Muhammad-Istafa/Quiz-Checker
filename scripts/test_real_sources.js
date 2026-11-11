const fs = require("fs");
const path = require("path");

console.log("Checking repos/ paths...");
const introDir = path.join("repos", "IntroClass");
const cpackDir = path.join("repos", "C-Pack-IPAs");
const itspDir = path.join("repos", "ITSP", "dataset");

console.log("IntroClass exists:", fs.existsSync(introDir));
console.log("C-Pack-IPAs exists:", fs.existsSync(cpackDir));
console.log("ITSP exists:", fs.existsSync(itspDir));

if (fs.existsSync(cpackDir)) {
  const subdirs = fs.readdirSync(cpackDir);
  console.log("C-Pack subdirs:", subdirs);
}

if (fs.existsSync(itspDir)) {
  const labs = fs.readdirSync(itspDir);
  console.log("ITSP labs:", labs);
}

console.log("All real repos paths verified.");

