const fs = require('fs');
const { callMcp, USERNAME } = require('./run_kaggle');

async function main() {
  const nbPath = 'notebooks/nb2b_nca.ipynb';
  const nbText = fs.readFileSync(nbPath, 'utf8');
  console.log(`Read ${nbPath}, size: ${nbText.length} bytes`);

  const payload = {
    request: {
      slug: `${USERNAME}/quiz-checker-nb2b`,
      newTitle: 'Quiz Checker nb2b',
      text: nbText,
      language: 'python',
      kernelType: 'notebook',
      isPrivate: true,
      enableGpu: true,
      enableInternet: true,
      kernelExecutionType: 'SaveAndRunAll',
      kernelDataSources: [
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

  console.log('Pushing and executing nb2b_nca on Kaggle (SaveAndRunAll, GPU T4, Internet ON)...');
  const res = await callMcp('save_notebook', payload);
  console.log('save_notebook result:', JSON.stringify(res, null, 2));

  // Wait 4 seconds and check session status
  await new Promise(r => setTimeout(r, 4000));
  const statusRes = await callMcp('get_notebook_session_status', {
    request: {
      userName: USERNAME,
      kernelSlug: 'quiz-checker-nb2b'
    }
  });
  console.log('Initial session status:', JSON.stringify(statusRes, null, 2));
}

main().catch(console.error);
