const { callMcp, USERNAME } = require('./run_kaggle');

async function main() {
  console.log('=== Monitoring quiz-checker-nb2 (Version 11) ===');
  let lastPrinted = 0;
  for (let cycle = 1; cycle <= 8; cycle++) {
    await new Promise(r => setTimeout(r, 20000));
    const statusRes = await callMcp('get_notebook_session_status', {
      request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb2' }
    });
    let st = 'unknown';
    try {
      st = JSON.parse(statusRes.result.content[0].text).status;
    } catch(e) {}

    const outRes = await callMcp('list_notebook_session_output', {
      request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb2' }
    });
    let data = {};
    try {
      data = JSON.parse(outRes.result.content[0].text);
    } catch(e) {}

    const logText = data.log || '';
    console.log(`[Cycle ${cycle}] Status: ${st} | Log size: ${logText.length}`);
    if (logText.length > lastPrinted) {
      const diff = logText.slice(lastPrinted);
      try {
        const parsed = JSON.parse(logText);
        // Print entries we haven't printed
        for (const item of parsed) {
          if (item.data) process.stdout.write(item.data);
        }
      } catch(e) {
        console.log(diff);
      }
      lastPrinted = logText.length;
    }

    if (st === 'COMPLETE' || st === 'ERROR') {
      console.log(`Session ended with status: ${st}`);
      break;
    }
  }
}

main().catch(console.error);
