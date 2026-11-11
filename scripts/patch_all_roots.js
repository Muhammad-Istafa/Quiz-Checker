const fs = require('fs');
const { pyToIpynb } = require('./py_to_ipynb.js');

function replaceSlowGlobInFindRoot(filePath, isN0) {
    let content = fs.readFileSync(filePath, 'utf8');

    if (isN0) {
        const oldPattern = `    cands += sorted({os.path.dirname(os.path.dirname(p))
                     for p in glob.glob("/kaggle/input/**/src/schema.py", recursive=True)})`;
        const newPattern = `    if os.path.isdir("/kaggle/input"):
        try:
            for item in os.listdir("/kaggle/input"):
                p = os.path.join("/kaggle/input", item)
                if os.path.isdir(p):
                    cands.append(p)
                    nested = os.path.join(p, "cpp-grader-code")
                    if os.path.isdir(nested):
                        cands.append(nested)
        except Exception:
            pass`;
        if (content.includes(oldPattern)) {
            content = content.replace(oldPattern, newPattern);
            console.log('Replaced slow glob in n0:', filePath);
        }
    } else {
        const oldPattern = `    kaggle = sorted({os.path.dirname(os.path.dirname(p))
                     for p in _glob.glob("/kaggle/input/**/src/schema.py", recursive=True)})
    kaggle += sorted({os.path.dirname(p)
                      for p in _glob.glob("/kaggle/input/**/schema.py", recursive=True)})
    cands += kaggle`;
        const newPattern = `    if os.path.isdir("/kaggle/input"):
        try:
            for item in os.listdir("/kaggle/input"):
                p = os.path.join("/kaggle/input", item)
                if os.path.isdir(p):
                    cands.append(p)
                    nested = os.path.join(p, "cpp-grader-code")
                    if os.path.isdir(nested):
                        cands.append(nested)
        except Exception:
            pass`;
        if (content.includes(oldPattern)) {
            content = content.replace(oldPattern, newPattern);
            console.log('Replaced slow glob in nb1:', filePath);
        }
    }

    fs.writeFileSync(filePath, content, 'utf8');
}

replaceSlowGlobInFindRoot('n0_audit.py', true);
replaceSlowGlobInFindRoot('cpp-grader-code/n0_audit.py', true);
replaceSlowGlobInFindRoot('nb1_data.py', false);
replaceSlowGlobInFindRoot('cpp-grader-code/nb1_data.py', false);

pyToIpynb('cpp-grader-code/n0_audit.py', 'notebooks/n0_audit.ipynb');
pyToIpynb('cpp-grader-code/nb1_data.py', 'notebooks/nb1_data.ipynb');

console.log('Successfully updated root finders.');

