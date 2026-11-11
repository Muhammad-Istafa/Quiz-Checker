const { callMcp } = require('./run_kaggle');

async function test() {
  console.log('--- Test 1: slug = "muhammadistafa/nb1-data" ---');
  let res = await callMcp('save_notebook', {
    request: {
      slug: 'muhammadistafa/nb1-data',
      newTitle: 'nb1_data',
      text: JSON.stringify({ cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 }),
      language: 'python',
      kernelType: 'notebook',
      isPrivate: true
    }
  });
  console.log('Result 1:', JSON.stringify(res, null, 2));

  console.log('--- Test 2: id = 142946733 ---');
  res = await callMcp('save_notebook', {
    request: {
      id: 142946733,
      newTitle: 'nb1_data',
      text: JSON.stringify({ cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 }),
      language: 'python',
      kernelType: 'notebook',
      isPrivate: true
    }
  });
  console.log('Result 2:', JSON.stringify(res, null, 2));
}

test().catch(console.error);

