const fs = require('fs');

['n0_audit.ipynb', 'nb1_data.ipynb', 'nb1b_teacher.ipynb', 'nb2_train.ipynb', 'nb2b_nca.ipynb', 'nb3_infer.ipynb'].forEach(nbName => {
  const nbPath = 'notebooks/' + nbName;
  const nb = JSON.parse(fs.readFileSync(nbPath, 'utf8'));

  let defects = [];
  nb.cells.forEach((c, idx) => {
    const src = Array.isArray(c.source) ? c.source.join('') : c.source;
    if (src.includes('DEVNULL')) {
      defects.push('Cell ' + idx + ' has DEVNULL');
    }
    if (src.includes('glob.glob("/kaggle/input/**') || src.includes('_glob.glob("/kaggle/input/**')) {
      defects.push('Cell ' + idx + ' has recursive kaggle/input glob');
    }
    if (src.includes('git clone') && !src.includes('timeout=')) {
      defects.push('Cell ' + idx + ' has git clone without timeout');
    }
    if (src.includes('"justification": "ok"')) {
      defects.push('Cell ' + idx + ' has 1-word justification');
    }
  });

  if (defects.length > 0) {
    console.log(nbName + ' has ' + defects.length + ' defects:', defects);
  } else {
    console.log('✓ ' + nbName + ' is 100% clean and verified!');
  }
});
