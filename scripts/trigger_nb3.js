const fs = require('fs');
const { callMcp, USERNAME } = require('./run_kaggle');

async function main() {
  const nbPath = 'notebooks/nb3_infer.ipynb';
  const nbText = fs.readFileSync(nbPath, 'utf8');
  console.log(`Read ${nbPath}, size: ${nbText.length} bytes`);

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

  console.log('Pushing and executing nb3_infer on Kaggle (SaveAndRunAll, GPU T4, Internet ON)...');
  const res = await callMcp('save_notebook', payload);
  console.log('save_notebook result:', JSON.stringify(res, null, 2));

  await new Promise(r => setTimeout(r, 4000));
  const statusRes = await callMcp('get_notebook_session_status', {
    request: {
      userName: USERNAME,
      kernelSlug: 'quiz-checker-nb3'
    }
  });
  console.log('Initial session status:', JSON.stringify(statusRes, null, 2));
}

main().catch(console.error);
