const fs = require('fs');

const logPath = 'C:/Users/istaf/.gemini/antigravity/brain/e0b8d225-9ce7-49b6-9bf9-8bde36465e2a/.system_generated/tasks/task-6071.log';
const log = fs.readFileSync(logPath, 'utf8');

const startIdx = log.indexOf('EVALUATION RESULTS');
if (startIdx !== -1) {
  const endIdx = log.indexOf('Confusion Matrix:', startIdx);
  console.log('=== RESULTS TABLE FROM NB3 RUN ===');
  console.log(log.slice(startIdx - 50, endIdx !== -1 ? endIdx : startIdx + 3000));
} else {
  console.log('EVALUATION RESULTS not found in log.');
}
