const { callMcp, USERNAME } = require('./run_kaggle');

async function main() {
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 15000));
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
    let l = 0;
    let data = {};
    try {
      data = JSON.parse(outRes.result.content[0].text);
      l = data.log ? data.log.length : 0;
    } catch(e) {}

    console.log(`[Check ${i+1}] Status: ${st} | Log size: ${l}`);
    if (l > 0) {
      try {
        const parsed = JSON.parse(data.log);
        for (const item of parsed) {
          if (item.data) process.stdout.write(item.data);
        }
      } catch(e) {
        console.log(data.log.slice(-1500));
      }
      break;
    }
  }
}

main().catch(console.error);
