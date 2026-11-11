const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

let src = nb.cells[5].source.join('');
const badLine = 'src_cands = [p for p in [os.path.join("/kaggle/input", d, "src", "prompts.py") for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else [] if "working" not in p]';
const goodLine = 'src_cands = [os.path.join("/kaggle/input", d, "src", "prompts.py") for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else []\n    src_cands = [p for p in src_cands if os.path.isfile(p)]';

src = src.replace(badLine, goodLine);
nb.cells[5].source = src.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);
fs.writeFileSync('notebooks/nb3_infer.ipynb', JSON.stringify(nb, null, 1), 'utf8');
console.log('Fixed syntax error in nb3_infer Cell 5');

