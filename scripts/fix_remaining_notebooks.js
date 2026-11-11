const fs = require('fs');

function replaceFastKaggleSearch(nbPath) {
  let nb = JSON.parse(fs.readFileSync(nbPath, 'utf8'));

  nb.cells.forEach(c => {
    if (c.cell_type === 'code') {
      let src = Array.isArray(c.source) ? c.source.join('') : c.source;

      // Replace /kaggle/input/**/schema_version.txt or src/schema.py or src/prompts.py
      if (src.includes('glob.glob("/kaggle/input/**/schema_version.txt", recursive=True)') ||
          src.includes('_glob.glob("/kaggle/input/**/src/schema.py", recursive=True)') ||
          src.includes('glob.glob("/kaggle/input/**/src/prompts.py", recursive=True)')) {
        src = src.replace(
          /cands\s*=\s*glob\.glob\("\/kaggle\/input\/\*\*\/schema_version\.txt",\s*recursive=True\)/g,
          'cands = [os.path.join("/kaggle/input", d, "config", "schema_version.txt") for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else []\n    cands = [p for p in cands if os.path.isfile(p)]'
        );
        src = src.replace(
          /src_cands\s*=\s*glob\.glob\("\/kaggle\/input\/\*\*\/src\/prompts\.py",\s*recursive=True\)/g,
          'src_cands = [os.path.join("/kaggle/input", d, "src", "prompts.py") for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else []\n    src_cands = [p for p in src_cands if os.path.isfile(p)]'
        );
        src = src.replace(
          /for p in _glob\.glob\("\/kaggle\/input\/\*\*\/src\/schema\.py",\s*recursive=True\)/g,
          'for p in ([os.path.join("/kaggle/input", d, "src", "schema.py") for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else []) if os.path.isfile(p)'
        );
        src = src.replace(
          /for p in _glob\.glob\("\/kaggle\/input\/\*\*\/schema\.py",\s*recursive=True\)/g,
          'for p in ([os.path.join("/kaggle/input", d, "schema.py") for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else []) if os.path.isfile(p)'
        );
      }

      // Replace /kaggle/input/**/train_sft.jsonl
      if (src.includes('glob.glob("/kaggle/input/**/train_sft.jsonl", recursive=True)')) {
        src = src.replace(
          /matches\s*=\s*glob\.glob\("\/kaggle\/input\/\*\*\/train_sft\.jsonl",\s*recursive=True\)/g,
          'matches = [os.path.join("/kaggle/input", d, "train_sft.jsonl") for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else []\n    matches = [p for p in matches if os.path.isfile(p)]'
        );
      }

      // Replace /kaggle/input/**/best_adapter
      if (src.includes('glob.glob("/kaggle/input/**/best_adapter", recursive=True)')) {
        src = src.replace(
          /cands\s*=\s*glob\.glob\("\/kaggle\/input\/\*\*\/best_adapter",\s*recursive=True\)/g,
          'cands = [os.path.join("/kaggle/input", d, "best_adapter") for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else []\n    cands = [p for p in cands if os.path.isdir(p)]'
        );
      }

      // Replace Quiz3 search in nb3_infer
      if (src.includes('/kaggle/input/**/Quiz3*') || src.includes('/kaggle/input/**/quiz3*')) {
        src = src.replace(
          /_glob\.glob\("\/kaggle\/input\/\*\*\/Quiz3\*\.\*",\s*recursive=True\)\s*\+\s*_glob\.glob\("\/kaggle\/input\/\*\*\/quiz3\*\.\*",\s*recursive=True\)\s*\+\s*_glob\.glob\("\/kaggle\/input\/\*\*\/Quiz3\*",\s*recursive=True\)\s*\+\s*_glob\.glob\("\/kaggle\/input\/\*\*\/quiz3\*",\s*recursive=True\)/g,
          '[os.path.join("/kaggle/input", d) for d in os.listdir("/kaggle/input") if "quiz3" in d.lower()] if os.path.isdir("/kaggle/input") else []'
        );
      }
      if (src.includes('_glob.glob("/kaggle/input/**/quiz3_split.json", recursive=True)')) {
        src = src.replace(
          /_split_cands\s*=\s*_glob\.glob\("\/kaggle\/input\/\*\*\/quiz3_split\.json",\s*recursive=True\)/g,
          '_split_cands = [os.path.join("/kaggle/input", d, "quiz3_split.json") for d in os.listdir("/kaggle/input")] if os.path.isdir("/kaggle/input") else []\n        _split_cands = [p for p in _split_cands if os.path.isfile(p)]'
        );
      }

      c.source = src.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);
    }
  });

  fs.writeFileSync(nbPath, JSON.stringify(nb, null, 1), 'utf8');
  console.log('Optimized fast paths in', nbPath);
}

replaceFastKaggleSearch('notebooks/nb1b_teacher.ipynb');
replaceFastKaggleSearch('notebooks/nb2_train.ipynb');
replaceFastKaggleSearch('notebooks/nb2b_nca.ipynb');
replaceFastKaggleSearch('notebooks/nb3_infer.ipynb');

