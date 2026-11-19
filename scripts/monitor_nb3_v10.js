const { callMcp, USERNAME } = require('./run_kaggle');

async function check() {
  const statusRes = await callMcp('get_notebook_session_status', {
    request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb3' }
  });
  const data = JSON.parse(statusRes.result.content[0].text);
  console.log(`[${new Date().toISOString()}] Status:`, data.status);
  
  if (data.status === 'RUNNING') {
    const outRes = await callMcp('list_notebook_session_output', {
      request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb3' }
    });
    const outData = JSON.parse(outRes.result.content[0].text);
    if (outData.log) {
      try {
        const logEntries = JSON.parse(outData.log);
        const lastFew = logEntries.slice(-10);
        console.log('--- Last 10 log messages ---');
        lastFew.forEach(e => {
          process.stdout.write(e.data || '');
        });
        console.log('\n---------------------------');
      } catch (e) {
        console.log('Raw log length:', outData.log.length);
      }
    }
  } else if (data.status === 'COMPLETE' || data.status === 'ERROR') {
    const outRes = await callMcp('list_notebook_session_output', {
      request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb3' }
    });
    const outData = JSON.parse(outRes.result.content[0].text);
    console.log('Final Files:', (outData.files || []).map(f => f.file_name));
    if (outData.log) {
      try {
        const logEntries = JSON.parse(outData.log);
        const lastFew = logEntries.slice(-20);
        console.log('--- Last 20 log messages ---');
        lastFew.forEach(e => {
          process.stdout.write(e.data || '');
        });
        console.log('\n---------------------------');
      } catch (e) {}
    }
  }
  return data.status;
}

check().catch(console.error);
