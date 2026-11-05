const fs = require('fs');
const path = require('path');

const xml = fs.readFileSync('quiz3_xlsx_extracted/xl/worksheets/sheet1.xml', 'utf8');

// Parse rows using regex on sheet1.xml
// Each row has <row r="N">...<c r="A..."><is><t>val</t></is></c>...<c r="C..."><v>num</v></c></row>
const rowRegex = /<row\s+r="(\d+)"[^>]*>(.*?)<\/row>/gs;
const cellRegex = /<c\s+r="([A-Z]+)\d+"[^>]*(?:t="([^"]*)")?[^>]*>(?:<is><t[^>]*>(.*?)<\/t><\/is>|<v>(.*?)<\/v>)?<\/c>/gs;

const rows = [];
let match;

while ((match = rowRegex.exec(xml)) !== null) {
    const rowNum = parseInt(match[1], 10);
    if (rowNum === 1) continue; // skip header
    const rowXml = match[2];
    
    let cellMatch;
    const cells = {};
    const cRegex = /<c\s+r="([A-Z]+)\d+"[^>]*>(.*?)<\/c>/gs;
    while ((cellMatch = cRegex.exec(rowXml)) !== null) {
        const col = cellMatch[1];
        const cellBody = cellMatch[2];
        const tMatch = /<t[^>]*>(.*?)<\/t>/s.exec(cellBody);
        const vMatch = /<v[^>]*>(.*?)<\/v>/s.exec(cellBody);
        if (tMatch) {
            // decode XML entities
            let text = tMatch[1]
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'");
            cells[col] = text;
        } else if (vMatch) {
            cells[col] = vMatch[1];
        } else {
            cells[col] = '';
        }
    }

    const rollNo = (cells['A'] || '').trim();
    const solution = (cells['B'] || '').trim();
    const gt = parseFloat(cells['C'] || '0');

    if (solution) {
        rows.push({
            rowNum,
            rollNo,
            gt,
            solution
        });
    }
}

console.log(`Parsed ${rows.length} rows.`);

// Ensure quiz3_raw directory exists
if (!fs.existsSync('quiz3_raw')) {
    fs.mkdirSync('quiz3_raw', { recursive: true });
}

fs.writeFileSync('quiz3_raw/quiz3_students.json', JSON.stringify(rows, null, 2));

rows.forEach((r, idx) => {
    const filename = `quiz3_raw/${String(idx + 1).padStart(2, '0')}_${r.rollNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.cpp`;
    fs.writeFileSync(filename, r.solution);
});

console.log('Saved quiz3_students.json and individual .cpp files.');

