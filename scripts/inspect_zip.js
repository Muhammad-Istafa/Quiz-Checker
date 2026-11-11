const fs = require('fs');

function readZipFilenames(zipPath) {
  const buf = fs.readFileSync(zipPath);
  const names = [];
  let pos = 0;
  while (pos < buf.length - 4) {
    // Check local file header signature 0x04034b50
    if (buf[pos] === 0x50 && buf[pos+1] === 0x4b && buf[pos+2] === 0x03 && buf[pos+3] === 0x04) {
      const fileNameLen = buf.readUInt16LE(pos + 26);
      const extraLen = buf.readUInt16LE(pos + 28);
      const name = buf.toString('utf8', pos + 30, pos + 30 + fileNameLen);
      names.push(name);
      pos += 30 + fileNameLen + extraLen;
    } else {
      pos++;
    }
  }
  return names;
}

console.log("=== cpp-grader-code.zip (Compress-Archive) ===");
const oldNames = readZipFilenames('cpp-grader-code.zip');
console.log(oldNames.slice(0, 10));

console.log("=== test_archive.zip (tar.exe) ===");
const newNames = readZipFilenames('test_archive.zip');
console.log(newNames.slice(0, 10));

