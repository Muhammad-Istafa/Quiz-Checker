const fs = require('fs');
const path = require('path');
const { ADAPTER_URLS } = require('./adapter_urls');

const nbPath = path.join(__dirname, '..', 'notebooks', 'nb3_infer.ipynb');
const nb = JSON.parse(fs.readFileSync(nbPath, 'utf8'));

let c6 = nb.cells[6].source.join('');

const downloadBlock = `
# ---------------------------------------------------------------------------
# Auto-extract cpp-grader-data-v2.zip and auto-download adapters if not present
# ---------------------------------------------------------------------------
_cloned_zip = "/kaggle/working/Quiz-Checker/cpp-grader-data-v2.zip"
if os.path.isfile(_cloned_zip) and not os.path.isdir("/kaggle/working/cpp-grader-data-v2"):
    import zipfile
    with zipfile.ZipFile(_cloned_zip, "r") as z:
        z.extractall("/kaggle/working")
    print("[PASS] Unzipped cpp-grader-data-v2")

import urllib.request
_ADAPTER_URLS = ${JSON.stringify(ADAPTER_URLS, null, 2)}

for _dest, _url in _ADAPTER_URLS.items():
    if not os.path.isfile(_dest):
        os.makedirs(os.path.dirname(_dest), exist_ok=True)
        try:
            urllib.request.urlretrieve(_url, _dest)
            print(f"[DOWNLOADED] {_dest} ({os.path.getsize(_dest)} bytes)")
        except Exception as _e:
            print(f"[WARN] Failed downloading {_dest}: {_e}")
`;

if (!c6.includes('_ADAPTER_URLS =')) {
  c6 = c6.replace('def resolve_data_dir(required_file="data_manifest.json"):', downloadBlock + '\ndef resolve_data_dir(required_file="data_manifest.json"):');
}

nb.cells[6].source = c6.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l);

fs.writeFileSync(nbPath, JSON.stringify(nb, null, 1), 'utf8');
console.log('Successfully injected downloadBlock into Cell 6 of nb3_infer.ipynb');
