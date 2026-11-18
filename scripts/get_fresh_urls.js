const { callMcp, USERNAME } = require('./run_kaggle');

async function main() {
  console.log('Fetching fresh output URLs from NB2 and NB2B...');
  
  const nb2Out = await callMcp('list_notebook_session_output', {
    request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb2' }
  });
  const data2 = JSON.parse(nb2Out.result.content[0].text);
  console.log('NB2 files count:', data2.files ? data2.files.length : 0);

  const nb2bOut = await callMcp('list_notebook_session_output', {
    request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb2b' }
  });
  const data2b = JSON.parse(nb2bOut.result.content[0].text);
  console.log('NB2B files count:', data2b.files ? data2b.files.length : 0);

  const urls = {};
  if (data2.files) {
    for (const f of data2.files) {
      if (f.file_name.startsWith('output/best_adapter')) {
        urls['/kaggle/working/' + f.file_name] = f.url;
      }
    }
  }
  if (data2b.files) {
    for (const f of data2b.files) {
      if (f.file_name.startsWith('output/nca_adapter')) {
        urls['/kaggle/working/' + f.file_name] = f.url;
      }
    }
  }

  console.log('Collected fresh URLs:', Object.keys(urls));
  const fs = require('fs');
  fs.writeFileSync('scripts/fresh_adapter_urls.json', JSON.stringify(urls, null, 2), 'utf8');
  console.log('Saved to scripts/fresh_adapter_urls.json');
}

main().catch(console.error);
