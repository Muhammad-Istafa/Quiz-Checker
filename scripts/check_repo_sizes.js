const fs = require('fs');
const path = require('path');

function getDirStats(dir) {
  let count = 0;
  let size = 0;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    if (item === '.git') continue; // Skip git internals
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      const sub = getDirStats(full);
      count += sub.count;
      size += sub.size;
    } else {
      count++;
      size += stat.size;
    }
  }
  return { count, size };
}

for (const r of ['C-Pack-IPAs', 'IntroClass', 'ITSP']) {
  const p = path.join('repos', r);
  if (fs.existsSync(p)) {
    const s = getDirStats(p);
    console.log(`${r}: ${s.count} files, ${(s.size / (1024 * 1024)).toFixed(2)} MB (excluding .git)`);
  }
}

