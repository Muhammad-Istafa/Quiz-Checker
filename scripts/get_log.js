const { callMcp, USERNAME } = require('./run_kaggle');

async function main() {
  const outRes = await callMcp('list_notebook_session_output', {
    request: {
      userName: USERNAME,
      kernelSlug: 'nb1-data'
    }
  });
  const text = outRes.result.content[0].text;
  const parsed = JSON.parse(text);
  if (parsed.log) {
    try {
      const logEntries = JSON.parse(parsed.log);
      for (const entry of logEntries) {
        process.stdout.write(entry.data);
      }
    } catch (e) {
      console.log('Raw log:', parsed.log);
    }
  } else {
    console.log('No log field found, keys:', Object.keys(parsed));
  }
}

main().catch(console.error);

