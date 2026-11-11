const fs = require('fs');
const { pyToIpynb } = require('./py_to_ipynb.js');

function updateAudit(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace _repo_code_files
  const oldCodeFilesRegex = /def _repo_code_files\(repo: str\) -> list:[\s\S]*?return keep/;
  const newCodeFiles = [
    'def _repo_code_files(repo: str) -> list:',
    '    skip_dirs = {',
    '        ".git", "node_modules", "__pycache__", "archive", "kaggle_bundle",',
    '        "repos", "C-Pack-IPAs", "ITSP", "IntroClass", "cpp-grader-repos",',
    '        "output", "ocr_results", "temp_test_extract", ".system_generated"',
    '    }',
    '    keep = []',
    '    for root, dirs, files in os.walk(repo):',
    '        # Prune large repos/data folders in-place so os.walk avoids scanning tens of thousands of files',
    '        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".")]',
    '        for fn in files:',
    '            if any(fn.endswith(ext) for ext in CODE_EXTS):',
    '                keep.append(os.path.join(root, fn))',
    '    return sorted(keep)'
  ].join('\n');

  if (oldCodeFilesRegex.test(content)) {
    content = content.replace(oldCodeFilesRegex, newCodeFiles);
    console.log('Replaced _repo_code_files in', filePath);
  } else {
    console.log('Could not find _repo_code_files in', filePath);
  }

  // Insert progress print statements into main()
  content = content.replace(
    'def main(argv=None) -> dict:\n    args = parse_args(argv)\n',
    'def main(argv=None) -> dict:\n    args = parse_args(argv)\n    print(f"[AUDIT] Starting pipeline audit (REPO_ROOT: {REPO_ROOT})...", flush=True)\n'
  );
  content = content.replace(
    'bank = parse_question_bank(args.nb1)\n',
    'print(f"[AUDIT] 1/5 Parsing question bank from {os.path.basename(args.nb1)}...", flush=True)\n    bank = parse_question_bank(args.nb1)\n'
  );
  content = content.replace(
    'data = data_checks(data_dir, bank, args.evidence_sample, args.seed) if data_dir else f"no dataset: {data_err}"\n',
    'print("[AUDIT] 2/5 Checking dataset splits & manifests...", flush=True)\n    data = data_checks(data_dir, bank, args.evidence_sample, args.seed) if data_dir else f"no dataset: {data_err}"\n'
  );
  content = content.replace(
    'files = collect_files(scan_dirs, args.out_dir)\n',
    'print("[AUDIT] 3/5 Collecting pipeline artifacts across scanned folders...", flush=True)\n    files = collect_files(scan_dirs, args.out_dir)\n'
  );
  content = content.replace(
    'cs = code_scan(REPO_ROOT, artifact_names)\n',
    'print("[AUDIT] 4/5 Performing static codebase scan...", flush=True)\n    cs = code_scan(REPO_ROOT, artifact_names)\n'
  );
  content = content.replace(
    'os.makedirs(args.out_dir, exist_ok=True)\n    md_path',
    'print("[AUDIT] 5/5 Generating PIPELINE_MAP.md and audit_report.json...", flush=True)\n    os.makedirs(args.out_dir, exist_ok=True)\n    md_path'
  );

  fs.writeFileSync(filePath, content, 'utf8');
}

updateAudit('n0_audit.py');
updateAudit('cpp-grader-code/n0_audit.py');
pyToIpynb('cpp-grader-code/n0_audit.py', 'notebooks/n0_audit.ipynb');
console.log('Regenerated notebooks/n0_audit.ipynb');
