const fs = require('fs');
const nbPath = 'notebooks/nb3_infer.ipynb';
const nb = JSON.parse(fs.readFileSync(nbPath, 'utf8'));

let c38 = nb.cells[38];
let src38 = Array.isArray(c38.source) ? c38.source.join('') : c38.source;

const oldResolve = /def _resolve_real_data_path\(\) -> str:[\s\S]*?return env_p or DEFAULT_KAGGLE_QUIZ3/;

const newResolve = `def _resolve_real_data_path() -> str:
    env_p = os.environ.get("REAL_DATA_PATH", "").strip()
    if env_p and os.path.exists(env_p):
        return env_p
    cands = [
        DEFAULT_KAGGLE_QUIZ3,
        "/kaggle/working/Quiz-Checker/Quiz3_1E.xlsx",
        "/kaggle/working/Quiz-Checker/quiz3_clean",
        "/kaggle/working/Quiz-Checker",
        "Quiz-Checker/Quiz3_1E.xlsx",
        "Quiz-Checker/quiz3_clean",
        "Quiz3_1E.xlsx",
        "/kaggle/input/quiz3-1e",
        "/kaggle/input/datasets/muhammadistafa/quiz3_1e",
        "/kaggle/input/quiz3_1e",
        "/kaggle/input/quiz3",
        "quiz3_extracted",
        "Quiz3-1E",
    ]
    for c in cands:
        if os.path.exists(c):
            return c
    matches = (
        [os.path.join("/kaggle/input", d) for d in os.listdir("/kaggle/input") if "quiz3" in d.lower()] if os.path.isdir("/kaggle/input") else []
    )
    if matches:
        return sorted(matches)[0]
    return env_p or DEFAULT_KAGGLE_QUIZ3`;

src38 = src38.replace(oldResolve, newResolve);
c38.source = src38;

fs.writeFileSync(nbPath, JSON.stringify(nb, null, 1), 'utf8');
console.log('Fixed Cell 38 _resolve_real_data_path indentation!');
