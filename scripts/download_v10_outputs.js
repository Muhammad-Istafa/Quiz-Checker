const fs = require('fs');
const https = require('https');
const { callMcp, USERNAME } = require('./run_kaggle');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(require('path').dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`Failed with status ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', err => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  console.log('Fetching files list from NB3 Version 10 session output...');
  const outRes = await callMcp('list_notebook_session_output', {
    request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb3' }
  });
  const data = JSON.parse(outRes.result.content[0].text);
  if (!data.files) {
    console.error('No files found in output!');
    return;
  }

  const outputFiles = data.files.filter(f => f.file_name.startsWith('output/'));
  console.log(`Found ${outputFiles.length} output files to download.`);

  for (const f of outputFiles) {
    const dest = f.file_name;
    try {
      await download(f.url, dest);
      console.log(`[OK] Downloaded: ${dest} (${fs.statSync(dest).size} bytes)`);
    } catch(e) {
      console.error(`[FAIL] ${dest}: ${e.message}`);
    }
  }

  console.log('All downloads complete!');
}

main().catch(console.error);
