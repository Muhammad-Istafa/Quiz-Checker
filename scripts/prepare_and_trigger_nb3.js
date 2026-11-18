const fs = require('fs');
const { callMcp, USERNAME } = require('./run_kaggle');

async function main() {
  console.log('=== Step 1: Fetching fresh adapter URLs from NB2 and NB2B ===');
  const nb2Out = await callMcp('list_notebook_session_output', {
    request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb2' }
  });
  const data2 = JSON.parse(nb2Out.result.content[0].text);
  console.log('NB2 files found:', data2.files ? data2.files.length : 0);

  const nb2bOut = await callMcp('list_notebook_session_output', {
    request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb2b' }
  });
  const data2b = JSON.parse(nb2bOut.result.content[0].text);
  console.log('NB2B files found:', data2b.files ? data2b.files.length : 0);

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

  const urlKeys = Object.keys(urls);
  console.log(`Gathered ${urlKeys.length} fresh adapter file URLs.`);
  if (urlKeys.length === 0) {
    throw new Error('Failed to fetch adapter URLs from NB2 / NB2B!');
  }

  // Format as Python dictionary string
  const entries = urlKeys.map(k => `  "${k}": "${urls[k]}"`).join(',\n');
  const pyDict = `_ADAPTER_URLS = {\n${entries}\n}`;

  console.log('=== Step 2: Injecting fresh URLs into notebooks/nb3_infer.ipynb ===');
  const nbPath = 'notebooks/nb3_infer.ipynb';
  const nb = JSON.parse(fs.readFileSync(nbPath, 'utf8'));

  let src6 = Array.isArray(nb.cells[6].source) ? nb.cells[6].source.join('') : nb.cells[6].source;
  src6 = src6.replace(/_ADAPTER_URLS\s*=\s*\{[\s\S]*?\n\}/, pyDict);
  nb.cells[6].source = src6;

  fs.writeFileSync(nbPath, JSON.stringify(nb, null, 1), 'utf8');
  console.log('Successfully injected fresh URLs into Cell 6 of nb3_infer.ipynb');

  console.log('=== Step 3: Triggering NB3 execution on Kaggle (GPU T4 x2, Internet ON) ===');
  const nbText = fs.readFileSync(nbPath, 'utf8');
  const payload = {
    request: {
      slug: `${USERNAME}/quiz-checker-nb3`,
      hasSlug: true,
      newTitle: 'Quiz Checker nb3',
      hasNewTitle: true,
      text: nbText,
      hasText: true,
      language: 'python',
      hasLanguage: true,
      kernelType: 'notebook',
      hasKernelType: true,
      isPrivate: true,
      hasIsPrivate: true,
      enableGpu: true,
      hasEnableGpu: true,
      enableInternet: true,
      hasEnableInternet: true,
      kernelExecutionType: 'SaveAndRunAll',
      hasKernelExecutionType: true,
      kernelDataSources: [
        `${USERNAME}/quiz-checker-nb2b`,
        `${USERNAME}/quiz-checker-nb2`,
        `${USERNAME}/nb1b-teacher`,
        `${USERNAME}/nb1-data`
      ],
      kernelDataSourcesSetter: [
        `${USERNAME}/quiz-checker-nb2b`,
        `${USERNAME}/quiz-checker-nb2`,
        `${USERNAME}/nb1b-teacher`,
        `${USERNAME}/nb1-data`
      ],
      datasetDataSources: [
        `${USERNAME}/cpp-grader-code`,
        `${USERNAME}/cpp-grader-repos`,
        `${USERNAME}/quiz3-1e`,
        `${USERNAME}/quiz3-split`
      ]
    }
  };

  const res = await callMcp('save_notebook', payload);
  console.log('save_notebook result:', JSON.stringify(res, null, 2));

  await new Promise(r => setTimeout(r, 4000));
  const statusRes = await callMcp('get_notebook_session_status', {
    request: { userName: USERNAME, kernelSlug: 'quiz-checker-nb3' }
  });
  console.log('Initial session status:', JSON.stringify(statusRes, null, 2));
}

main().catch(err => {
  console.error('Fatal trigger error:', err);
  process.exit(1);
});
