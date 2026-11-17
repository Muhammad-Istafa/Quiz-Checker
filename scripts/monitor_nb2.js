const { callMcp, USERNAME } = require('./run_kaggle');

async function main() {
  console.log('=== Active Monitor: quiz-checker-nb2 (Version 12) ===');
  let lastPrinted = 0;

  let cycle = 0;
  while (true) {
    cycle++;
    await new Promise(r => setTimeout(r, 20000));
    
    let st = 'unknown';
    let logText = '';
    try {
      // Check status
      const statusRes = await callMcp('get_notebook_session_status', {
        request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb2' }
      });
      try {
        st = JSON.parse(statusRes.result.content[0].text).status;
      } catch(e) {}

      // Check logs
      const outRes = await callMcp('list_notebook_session_output', {
        request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb2' }
      });
      let data = {};
      try {
        data = JSON.parse(outRes.result.content[0].text);
      } catch(e) {}
      logText = data.log || '';
    } catch (netErr) {
      console.log(`[Cycle ${cycle}] Network transient error: ${netErr.message} (retrying...)`);
      continue;
    }

    console.log(`[Cycle ${cycle} | +${Math.round(cycle*20/60)}m] Status: ${st} | Log size: ${logText.length}`);

    if (logText.length > lastPrinted) {
      try {
        const parsed = JSON.parse(logText);
        for (let i = lastPrinted; i < parsed.length; i++) {
          if (parsed[i].data) process.stdout.write(parsed[i].data);
        }
        lastPrinted = parsed.length;
      } catch(e) {
        console.log(logText.slice(lastPrinted));
        lastPrinted = logText.length;
      }
    }

    if (st === 'COMPLETE') {
      console.log('\n========================================');
      console.log('🎉 TRAINING SESSION COMPLETED SUCCESSFULLY!');
      console.log('========================================');
      if (logText && lastPrinted < logText.length) {
        console.log(logText.slice(lastPrinted));
      }
      break;
    }

    if (st === 'ERROR') {
      console.log('\n========================================');
      console.log('❌ TRAINING SESSION FAILED:');
      console.log('========================================');
      if (logText && lastPrinted < logText.length) {
        console.log(logText.slice(lastPrinted));
      }
      break;
    }
  }
}

main().catch(console.error);
