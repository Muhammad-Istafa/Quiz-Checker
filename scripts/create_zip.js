const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function walkDir(dir, baseDir = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const relPath = path.posix.join(baseDir, file); // Always use forward slashes
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walkDir(fullPath, relPath));
    } else {
      results.push({ fullPath, relPath, size: stat.size });
    }
  }
  return results;
}

function createZip(sourceDir, outZipPath) {
  const files = walkDir(sourceDir);
  const localHeaders = [];
  const centralHeaders = [];
  let currentOffset = 0;

  for (const file of files) {
    const content = fs.readFileSync(file.fullPath);
    const uncompressedSize = content.length;
    const crc = zlib.crc32(content);
    const compressed = zlib.deflateRawSync(content);
    const compressedSize = compressed.length;
    const nameBuf = Buffer.from(file.relPath, 'utf8');

    // Local Header (30 bytes + name + data)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);          // version needed
    localHeader.writeUInt16LE(0, 6);           // flags
    localHeader.writeUInt16LE(8, 8);           // compression: deflate
    localHeader.writeUInt16LE(0, 10);          // mod time
    localHeader.writeUInt16LE(0, 12);          // mod date
    localHeader.writeUInt32LE(crc, 14);        // crc32
    localHeader.writeUInt32LE(compressedSize, 18);   // compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);   // filename length
    localHeader.writeUInt16LE(0, 28);          // extra length

    const localRecord = Buffer.concat([localHeader, nameBuf, compressed]);
    localHeaders.push(localRecord);

    // Central Directory Header (46 bytes + name)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4);          // version made by (DOS/FAT compatible)
    centralHeader.writeUInt16LE(20, 6);          // version needed
    centralHeader.writeUInt16LE(0, 8);           // flags
    centralHeader.writeUInt16LE(8, 10);          // compression: deflate
    centralHeader.writeUInt16LE(0, 12);          // mod time
    centralHeader.writeUInt16LE(0, 14);          // mod date
    centralHeader.writeUInt32LE(crc, 16);        // crc32
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);          // extra length
    centralHeader.writeUInt16LE(0, 32);          // comment length
    centralHeader.writeUInt16LE(0, 34);          // disk number start
    centralHeader.writeUInt16LE(0, 36);          // internal file attributes
    centralHeader.writeUInt32LE(0x81a40000, 38); // external attributes (-rw-r--r--)
    centralHeader.writeUInt32LE(currentOffset, 42); // local header offset

    const centralRecord = Buffer.concat([centralHeader, nameBuf]);
    centralHeaders.push(centralRecord);

    currentOffset += localRecord.length;
  }

  const centralDirBuffer = Buffer.concat(centralHeaders);
  const centralDirOffset = currentOffset;
  const centralDirSize = centralDirBuffer.length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4);          // disk number
  eocd.writeUInt16LE(0, 6);          // start disk
  eocd.writeUInt16LE(files.length, 8); // entries on this disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);         // comment length

  const finalZip = Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
  fs.writeFileSync(outZipPath, finalZip);
  console.log(`Successfully created standard zip: ${outZipPath} (${finalZip.length} bytes, ${files.length} files)`);
}

createZip('cpp-grader-code', 'cpp-grader-code.zip');

