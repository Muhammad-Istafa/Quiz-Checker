const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

let src = nb.cells[5].source.join('');
src = src.replace(
  'glob.glob(f"/kaggle/input/**/{required_file}", recursive=True)',
  '[os.path.join("/kaggle/input", d, required_file) for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else []'
);
src = src.replace(
  '_glob.glob("/kaggle/input/**/src/prompts.py", recursive=True)',
  '[os.path.join("/kaggle/input", d, "src", "prompts.py") for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else []'
);
nb.cells[5].source = src.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);
fs.writeFileSync('notebooks/nb3_infer.ipynb', JSON.stringify(nb, null, 1), 'utf8');
console.log('Patched Cell 5 in nb3_infer.ipynb');

