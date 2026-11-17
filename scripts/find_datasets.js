const { callMcp, USERNAME } = require('./run_kaggle');

async function main() {
  for (const grp of ['MyPrivate', 'My', 'User', 'All']) {
    const res = await callMcp('search_datasets', {
      request: {
        user: USERNAME,
        group: grp
      }
    });
    console.log(`=== Group ${grp} ===`);
    console.log(res.result.content[0].text);
  }
}

main().catch(console.error);

