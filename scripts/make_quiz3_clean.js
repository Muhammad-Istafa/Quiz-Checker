const fs = require('fs');
const path = require('path');

const students = JSON.parse(fs.readFileSync('quiz3_raw/quiz3_students.json', 'utf8'));

if (!fs.existsSync('quiz3_clean')) {
    fs.mkdirSync('quiz3_clean', { recursive: true });
}

function cleanStudentCode(rawCode) {
    // Rule 1: Strip prepended assignment prompt / OCR header
    // Header pattern: lines before the first C++ declaration (#include, using, or main)
    const lines = rawCode.split(/\r?\n/);
    let startIdx = 0;
    for (let i = 0; i < lines.length; i++) {
        const tr = lines[i].trim();
        if (tr.startsWith('#include') || tr.startsWith('using namespace') || tr.startsWith('int main') || tr.startsWith('void main')) {
            startIdx = i;
            break;
        }
    }
    const codeLines = lines.slice(startIdx);
    // Rule 2: Normalize line endings to \n and trim trailing whitespace
    return codeLines.join('\n').trim() + '\n';
}

const cleanedStudents = students.map(s => {
    const cleaned = cleanStudentCode(s.solution);
    return {
        ...s,
        cleanedSolution: cleaned,
        wasModified: cleaned !== (s.solution.replace(/\r\n/g, '\n').trim() + '\n')
    };
});

fs.writeFileSync('quiz3_clean/quiz3_clean_students.json', JSON.stringify(cleanedStudents, null, 2));

cleanedStudents.forEach((s, idx) => {
    const filename = `quiz3_clean/${String(idx + 1).padStart(2, '0')}_${s.rollNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.cpp`;
    fs.writeFileSync(filename, s.cleanedSolution);
});

const modified = cleanedStudents.filter(s => s.wasModified);
console.log(`Saved 46 cleaned files to quiz3_clean/. Modified ${modified.length} files with header junk.`);
modified.forEach(s => {
    console.log(`- ${s.rollNo} (GT: ${s.gt}) had header stripped.`);
});

