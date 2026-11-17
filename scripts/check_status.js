const { callMcp, USERNAME } = require('./run_kaggle');

async function check(slug = 'nb1-data') {
  const statusRes = await callMcp('get_notebook_session_status', {
    request: {
      userName: USERNAME,
      kernelSlug: slug
    }
  });
  console.log(`[${new Date().toISOString()}] ${slug} Status:`, JSON.stringify(statusRes, null, 2));

  const outRes = await callMcp('list_notebook_session_output', {
    request: {
      userName: USERNAME,
      kernelSlug: slug,
      pageSize: 50
    }
  });
  console.log(`[${new Date().toISOString()}] Output files:`, JSON.stringify(outRes, null, 2));
}

const slugArg = process.argv[2] || 'nb1-data';
check(slugArg).catch(console.error);

