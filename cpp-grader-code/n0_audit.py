# %% [markdown]
# # NB0: Pipeline audit (README Phase 0)
#
# | | |
# |---|---|
# | Inputs | NB1 dataset folder, optional OCR / training output folders, this repo's code |
# | Files read | every file in the scanned folders, `nb1_data.py` (parsed, never executed), repo `*.py` / `*.js` |
# | Files written | `PIPELINE_MAP.md`, `audit_report.json` (in `--out-dir`) |
# | Metrics | records per file, keys/types, distinct programs per split, cross-split overlap, review rate, evidence-line check, execution-report consistency |
# | Failure cases | missing folders/files, invalid JSON/JSONL lines, mixed schema versions (reported, never converted), unparseable question bank |
#
# This script changes no input file and fills no table from assumptions.
# Anything it cannot measure is written as `not measured` with the reason.
#
# Local:  python n0_audit.py --data-dir path/to/data_v1_1 [--scan-dir path/to/ocr_results ...]
# Kaggle: attach the NB1 output dataset and the project dataset (src/, config/), then run.

# %%
import argparse
import ast
import fnmatch
import glob
import hashlib
import json
import os
import random
import re
import statistics
import sys
import textwrap
import time
from collections import Counter, defaultdict

def _find_repo_root() -> str:
    """Folder with src/schema.py: CPP_GRADER_ROOT, this file's folder, cwd, or one attached Kaggle dataset."""
    cands = [os.environ.get("CPP_GRADER_ROOT", "")]
    if "__file__" in globals():
        cands.append(os.path.dirname(os.path.abspath(__file__)))
    cands.append(os.getcwd())
    cands += sorted({os.path.dirname(os.path.dirname(p))
                     for p in glob.glob("/kaggle/input/**/src/schema.py", recursive=True)})
    for c in cands:
        if c and os.path.isfile(os.path.join(c, "src", "schema.py")):
            return c
    raise RuntimeError(f"src/schema.py not found in {cands}; set CPP_GRADER_ROOT.")


REPO_ROOT = _find_repo_root()
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from src.schema import SCHEMA_VERSION, validate_grading_output, strip_line_number
from src.prompts import SYSTEM_PROMPT, add_line_numbers, build_gold_output
from src.parse import extract_reasoning_and_json
from src import paths as _paths

SPLITS = [
    "train", "val", "val_seen", "val_unseen",
    "test_seen", "test_unseen", "test_unseen_synth", "test_unseen_real_tasks"
]
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp")
IMAGE_KEY_HINTS = ("image", "img", "path", "scan")
MAX_EXAMPLE_CHARS = 300
CODE_EXTS = (".py", ".js")


# %%
# ============================================================================
# 1. GENERIC FILE INSPECTION
# ============================================================================

def _type_name(v) -> str:
    if v is None:
        return "null"
    return {bool: "bool", int: "int", float: "float", str: "str",
            list: "list", dict: "dict"}.get(type(v), type(v).__name__)


def _truncate(obj) -> str:
    s = json.dumps(obj, ensure_ascii=False, default=str)
    if len(s) <= MAX_EXAMPLE_CHARS:
        return s
    return s[:MAX_EXAMPLE_CHARS] + f"... (+{len(s) - MAX_EXAMPLE_CHARS} chars)"


def _image_refs(obj, prefix="", out=None) -> set:
    """Field paths whose key looks like an image/path field or whose value is an image filename."""
    out = set() if out is None else out
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{prefix}.{k}" if prefix else str(k)
            if isinstance(v, str) and v and (v.lower().endswith(IMAGE_EXTS)
                                             or any(h in str(k).lower() for h in IMAGE_KEY_HINTS)):
                out.add(p)
            elif isinstance(v, (dict, list)):
                _image_refs(v, p, out)
    elif isinstance(obj, list):
        for v in obj[:20]:
            _image_refs(v, prefix + "[]", out)
    return out


def _key_types(records) -> dict:
    kt = defaultdict(Counter)
    for r in records:
        if isinstance(r, dict):
            for k, v in r.items():
                kt[k][_type_name(v)] += 1
    return {k: dict(c) for k, c in sorted(kt.items())}


def read_jsonl(path):
    records, bad = [], []
    with open(path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as e:
                bad.append({"line": i, "error": str(e)})
    return records, bad


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _refs_union(records) -> list:
    out = set()
    for r in records[:200]:
        out |= _image_refs(r)
    return sorted(out)


def inspect_file(path: str) -> dict:
    info = {"path": path, "size_bytes": os.path.getsize(path), "kind": "other"}
    low = path.lower()
    try:
        if low.endswith(".jsonl"):
            recs, bad = read_jsonl(path)
            info.update(kind="jsonl", n_records=len(recs), n_invalid_lines=len(bad),
                        invalid_lines=bad[:5], key_types=_key_types(recs),
                        examples=[_truncate(r) for r in recs[:3]],
                        image_ref_fields=_refs_union(recs))
        elif low.endswith(".json"):
            _inspect_json(load_json(path), info)
        elif low.endswith(IMAGE_EXTS):
            info["kind"] = "image"
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as e:
        info["kind"] = "unreadable"
        info["error"] = str(e)
    return info


def _inspect_json(data, info: dict) -> None:
    info["kind"] = "json"
    info["top_level_type"] = _type_name(data)
    if isinstance(data, dict):
        keys = list(data.keys())
        vals = list(data.values())
        info["n_records"] = len(keys)
        info["example_keys"] = keys[:5]
        if vals and all(isinstance(v, dict) for v in vals[:50]):
            info["layout"] = "dict of objects"
            info["value_key_types"] = _key_types(vals[:500])
            info["image_ref_fields"] = _refs_union(vals)
        else:
            info["layout"] = "single object"
            info["key_types"] = _key_types([data])
            info["image_ref_fields"] = sorted(_image_refs(data))
        info["examples"] = [_truncate({k: data[k]}) for k in keys[:3]]
    elif isinstance(data, list):
        info["layout"] = "list"
        info["n_records"] = len(data)
        info["key_types"] = _key_types(data[:500])
        info["examples"] = [_truncate(r) for r in data[:3]]
        info["image_ref_fields"] = _refs_union(data)


def infer_role(info: dict, split_ids: set) -> tuple:
    """Role from what the file contains. Returns (role, basis)."""
    name = os.path.basename(info["path"])
    kt = info.get("key_types") or {}
    vkt = info.get("value_key_types") or {}
    if info["kind"] in ("image", "image_group"):
        return "images", "image file extensions"
    if info["kind"] == "unreadable":
        return "unreadable", info.get("error", "")
    if "messages" in kt:
        return "train (chat SFT examples)", "records have a 'messages' field"
    if "gold_criteria" in kt and "student_answer" in kt:
        split = name[:-len(".jsonl")] if name.endswith(".jsonl") else name
        use = {"train": "train split", "val": "validation split"}.get(
            split, "held-out eval split" if split in SPLITS else "unknown split")
        return f"GT + labels ({use})", "records have student_answer + gold_criteria"
    if "raw_ocr_output" in kt or "raw_ocr_output" in vkt:
        return "OCR output", "records have raw_ocr_output"
    if {"schema_version", "file_hashes"} <= set(kt):
        return "metadata (dataset manifest)", "object has schema_version + file_hashes"
    if info.get("layout") == "dict of objects":
        keys = info.get("example_keys", [])
        if keys and all(re.fullmatch(r"[0-9a-f]{32}", str(k)) for k in keys):
            return "cache (keyed by md5 hash)", "keys are 32-hex digests"
        if split_ids and keys and all(k in split_ids for k in keys):
            return "execution report (per sample)", "keys are sample_ids from the split files"
    if "compile_ok" in vkt:
        return "execution report", "values have compile_ok"
    if name.endswith(".json") and "replay" in name:
        return "unresolved (see replay_buffer_manifest section)", "file name only; contents reported below"
    return "unknown, inspect manually", "no rule matched"


# %%
# ============================================================================
# 2. QUESTION BANK (parsed statically from nb1_data.py, never executed)
# ============================================================================

def parse_question_bank(nb1_path: str) -> dict:
    """{qid: {...}} parsed with ast.literal_eval, or {"_error": reason}."""
    if not os.path.isfile(nb1_path):
        return {"_error": f"{nb1_path} not found"}
    try:
        with open(nb1_path, encoding="utf-8") as f:
            tree = ast.parse(f.read())
    except SyntaxError as e:
        return {"_error": f"cannot parse nb1_data.py: {e}"}
    bank_node = None
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
                isinstance(t, ast.Name) and t.id == "QUESTION_BANK" for t in node.targets):
            bank_node = node.value
    if not isinstance(bank_node, ast.List):
        return {"_error": "QUESTION_BANK = [...] literal not found"}
    bank, failed = {}, []
    for call in bank_node.elts:
        try:
            qid, family, _text, _mx, rubric, solution, tcs, muts = [ast.literal_eval(a) for a in call.args]
        except (ValueError, TypeError, SyntaxError) as e:
            failed.append(str(e)[:120])
            continue
        bank[qid] = {"family": family, "rubric_ids": [r["id"] for r in rubric],
                     "reference_solution": textwrap.dedent(solution),
                     "test_cases": tcs, "mutations": {m["name"]: m for m in muts}}
    if failed:
        bank["_partial_errors"] = failed
    return bank


def exec_cache_key(code: str, test_cases: list) -> str:
    """Same key NB1's batch_execute_codes uses for its execution cache."""
    tcs = [(t["in"], t["out"]) for t in test_cases]
    return hashlib.md5(f"{code}\n{tcs}".encode()).hexdigest()


def _ws(s: str) -> str:
    return re.sub(r"\s+", "", s)


_CPP_KEYWORDS = {
    "int", "long", "short", "char", "bool", "float", "double", "void", "unsigned", "signed", "const",
    "auto", "if", "else", "for", "while", "do", "return", "break", "continue", "switch", "case",
    "default", "true", "false", "class", "struct", "public", "private", "protected", "using",
    "namespace", "std", "include", "cin", "cout", "endl", "string", "vector", "new", "delete",
    "sizeof", "static", "main", "size", "length", "push_back", "getline", "nullptr",
}
_TOKEN_RE = re.compile(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_]\w*|\d+(?:\.\d+)?|\S')


def _shape(line: str) -> str:
    """Line with comments, whitespace and user identifiers removed (renaming-invariant)."""
    line = re.sub(r"/\*.*?\*/", "", line)
    line = re.sub(r"//.*", "", line)
    toks = []
    for t in _TOKEN_RE.findall(line):
        toks.append("ID" if re.fullmatch(r"[A-Za-z_]\w*", t) and t not in _CPP_KEYWORDS else t)
    return " ".join(toks)


def intended_mutated_lines(q: dict, program_id: str) -> dict:
    """{mutation name: text of its line after ALL of the program's mutations}, from the bank.

    Mutations are single-line and keep the line count (NB1 asserts this), so a mutation's
    line index is where its `find` occurs in the reference solution."""
    in_prog = set(program_id.split("__", 1)[1].split("+")) if "__" in program_id else set()
    # NB1 enumerates subsets with itertools.combinations over q.mutations, so mutations are
    # applied in question-bank order (the program_id suffix is only sorted for naming).
    names = [n for n in q["mutations"] if n in in_prog]
    ref = q["reference_solution"]
    code = ref
    for n in names:
        m = q["mutations"][n]
        if m["find"] in code:
            code = code.replace(m["find"], m["replace"], 1)
    lines = code.split("\n")
    out = {}
    for n in names:
        pos = ref.find(q["mutations"][n]["find"])
        if pos >= 0:
            idx = ref.count("\n", 0, pos)
            if idx < len(lines):
                out[n] = lines[idx]
    return out


# %%
# ============================================================================
# 3. DATA CHECKS
# ============================================================================

def load_splits(data_dir: str) -> dict:
    splits = {}
    for sn in SPLITS:
        p = os.path.join(data_dir, f"{sn}.jsonl")
        if os.path.isfile(p):
            splits[sn], _ = read_jsonl(p)
    return splits


def capacity(splits: dict) -> dict:
    cap = {}
    for sn, recs in splits.items():
        per_prog = Counter(r.get("program_id") for r in recs)
        counts = list(per_prog.values()) or [0]
        n_rev = sum(1 for r in recs if r.get("needs_human_review"))
        cap[sn] = {
            "n_samples": len(recs),
            "n_distinct_programs": len(per_prog),
            "n_distinct_questions": len({r.get("question_id") for r in recs}),
            "renderings_per_program": {"min": min(counts), "median": statistics.median(counts),
                                       "max": max(counts)},
            "unseen_kind": dict(Counter(r.get("unseen_kind") for r in recs)),
            "n_review": n_rev,
            "review_rate": round(n_rev / max(1, len(recs)), 4),
            "n_garbled": sum(1 for r in recs if r.get("is_garbled")),
            "n_heavy_ocr": sum(1 for r in recs if r.get("is_heavy_ocr")),
            "n_duplicate_sample_ids": len(recs) - len({r.get("sample_id") for r in recs}),
        }
    return cap


def leakage(splits: dict) -> dict:
    progs = {sn: {r.get("program_id") for r in recs} for sn, recs in splits.items()}
    qids = {sn: {r.get("question_id") for r in recs} for sn, recs in splits.items()}
    names = list(splits)
    overlap = {}
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            shared = sorted(progs[a] & progs[b])
            overlap[f"{a} & {b}"] = {"programs": len(shared), "examples": shared[:5]}
    out = {"program_overlap": overlap}
    if "test_unseen" in qids:
        others = set().union(*[qids[s] for s in names if s != "test_unseen"])
        out["test_unseen_questions_also_in_other_splits"] = sorted(qids["test_unseen"] & others)
    return out


def gold_check(all_recs: list) -> dict:
    n_fail, examples = 0, []
    criteria_incomplete = 0
    max_marks_mismatch = 0
    for r in all_recs:
        rubric = r.get("rubric", [])
        gold_criteria = r.get("gold_criteria", [])
        # Check max_marks sum
        rubric_sum = round(sum(c.get("max_marks", 0.0) for c in rubric) * 2) / 2.0
        rec_max = round(float(r.get("max_marks", 0.0)) * 2) / 2.0
        if abs(rubric_sum - rec_max) > 0.01:
            max_marks_mismatch += 1

        # Check that all rubric criteria appear in gold_criteria
        rubric_ids = {c["id"] for c in rubric if isinstance(c, dict)}
        gold_ids = {c["id"] for c in gold_criteria if isinstance(c, dict)}
        if rubric_ids != gold_ids:
            criteria_incomplete += 1

        gold = build_gold_output(gold_criteria, bool(r.get("needs_human_review")))
        ok, errs = validate_grading_output(gold, rubric, r.get("student_answer", ""))
        if not ok:
            n_fail += 1
            if len(examples) < 5:
                examples.append({"sample_id": r.get("sample_id"), "errors": errs[:3]})
    return {
        "n": len(all_recs),
        "n_fail": n_fail,
        "criteria_incomplete": criteria_incomplete,
        "max_marks_mismatch": max_marks_mismatch,
        "examples": examples,
        "validator_schema_version": SCHEMA_VERSION
    }


def numbering_check(all_recs: list) -> dict:
    ok = sum(1 for r in all_recs
             if add_line_numbers(r.get("student_answer_raw", "")) == r.get("student_answer"))
    return {"n": len(all_recs), "matches": ok}


def evidence_check(all_recs: list, bank: dict, n_sample: int, seed: int) -> dict:
    """Does a cited evidence line contain the text of a mutation that deducts that criterion?"""
    if not bank or "_error" in bank:
        return {"status": "not measured",
                "reason": (bank or {}).get("_error", "question bank unavailable")}
    cands = [r for r in all_recs if any(c.get("evidence_lines") for c in r.get("gold_criteria", []))]
    sample = random.Random(seed).sample(cands, min(n_sample, len(cands)))
    stats = defaultdict(lambda: {"criteria": 0, "no_mutation_text": 0, "hit_exact": 0, "hit_shape": 0})
    misses = []
    for r in sample:
        q = bank.get(r.get("question_id"))
        if not q:
            continue
        lines = r.get("student_answer", "").split("\n")
        noise = ("ocr_noise" if r.get("has_ocr_noise")
                 else "style_noise" if r.get("has_style_noise") else "clean")
        for c in r.get("gold_criteria", []):
            ev = c.get("evidence_lines") or []
            if not ev:
                continue
            st = stats[noise]
            st["criteria"] += 1
            intended = intended_mutated_lines(q, r.get("program_id", ""))
            targets = [intended[m] for m in r.get("mutations_applied", [])
                       if m in intended and c["id"] in q["mutations"][m].get("deductions", {})
                       and not q["mutations"][m].get("is_missing")]
            if not targets:
                st["no_mutation_text"] += 1
                continue
            cited = [strip_line_number(lines[ln - 1]) for ln in ev
                     if isinstance(ln, int) and 1 <= ln <= len(lines)]
            st["hit_exact"] += any(_ws(t) == _ws(l) for t in targets for l in cited)
            hit = any(_shape(t) == _shape(l) for t in targets for l in cited)
            st["hit_shape"] += hit
            if not hit and len(misses) < 12:
                misses.append({"sample_id": r.get("sample_id"), "criterion": c["id"],
                               "expected_line": targets, "cited_lines": ev,
                               "cited_text": [l[:120] for l in cited]})
    return {"status": "measured", "n_records_with_evidence": len(cands),
            "n_records_sampled": len(sample), "seed": seed, "by_noise": dict(stats),
            "miss_examples": misses,
            "note": ("expected line = the program's intended code line for a mutation that deducts this "
                     "criterion (rebuilt from the question bank). hit_exact: cited line equals it ignoring "
                     "whitespace. hit_shape: equal after also removing comments and replacing user "
                     "identifiers (renaming noise). OCR-noised lines can still differ.")}


def execution_check(data_dir: str, all_recs: list, bank: dict) -> dict:
    by_id = {r.get("sample_id"): r for r in all_recs}
    out = {}
    er_path = os.path.join(data_dir, "execution_reports.json")
    if os.path.isfile(er_path):
        er = load_json(er_path)
        out["execution_reports_vs_records"] = {
            "n_records": len(all_recs),
            "missing_in_reports": sum(1 for r in all_recs if r.get("sample_id") not in er),
            "equal": sum(1 for r in all_recs if er.get(r.get("sample_id")) == r.get("execution_report")),
            "report_keys_not_in_splits": sum(1 for k in er if k not in by_id),
        }
    else:
        out["execution_reports_vs_records"] = "not measured: execution_reports.json missing"

    cache_path = os.path.join(data_dir, "exec_cache.json")
    if not os.path.isfile(cache_path):
        out["report_matches_shown_code"] = "not measured: exec_cache.json missing"
    elif not bank or "_error" in bank:
        out["report_matches_shown_code"] = "not measured: question bank unavailable"
    else:
        cache = load_json(cache_path)
        n = hit = eq = 0
        for r in all_recs:
            q = bank.get(r.get("question_id"))
            if not q:
                continue
            n += 1
            ck = exec_cache_key(r.get("student_answer_raw", ""), q["test_cases"])
            if ck in cache:
                hit += 1
                eq += cache[ck] == r.get("execution_report")
        out["report_matches_shown_code"] = {
            "n": n, "cache_entry_for_shown_code": hit, "equal_to_stored_report": eq,
            "note": "recomputes NB1's cache key from student_answer_raw (the code shown to the model)"}
    return out


def sft_check(data_dir: str, all_recs: list) -> dict:
    by_id = {r.get("sample_id"): r for r in all_recs}
    out = {}
    # Check v1, v2 reasoning, and v2 direct files
    sft_targets = [
        ("train", "train_sft.jsonl"),
        ("val", "val_sft.jsonl"),
        ("train_v2", "train_sft_v2.jsonl"),
        ("train_v2_direct", "train_sft_v2_direct.jsonl"),
        ("val_v2", "val_sft_v2.jsonl"),
    ]
    for key, fname in sft_targets:
        p = os.path.join(data_dir, fname)
        if not os.path.isfile(p):
            out[key] = "missing"
            continue
        rows, _ = read_jsonl(p)
        sys_ok = tgt_ok = known = reasoning_ok = 0
        for x in rows:
            msgs = x.get("messages") or []
            r = by_id.get(x.get("sample_id"))
            known += r is not None
            sys_ok += bool(msgs) and msgs[0].get("content") == SYSTEM_PROMPT
            if r is not None and msgs:
                resp = msgs[-1].get("content", "")
                gold = build_gold_output(r.get("gold_criteria", []), bool(r.get("needs_human_review")))
                if resp == gold:
                    tgt_ok += 1
                else:
                    # Check structured reasoning target (Let's think step-by-step)
                    rsn, j_str, _ = extract_reasoning_and_json(resp)
                    if rsn.startswith("Let's think step-by-step.") and j_str == gold:
                        reasoning_ok += 1
                        tgt_ok += 1

        out[key] = {
            "n_rows": len(rows),
            "sample_ids_in_split_files": known,
            "system_prompt_equals_current_src": sys_ok,
            "target_equals_gold": tgt_ok,
            "structured_reasoning_targets": reasoning_ok,
            "schema_versions": dict(Counter(x.get("schema_version") for x in rows))
        }
    return out


def manifest_check(data_dir: str, splits: dict) -> object:
    mp = os.path.join(data_dir, _paths.MANIFEST_NAME)
    if not os.path.isfile(mp):
        return "missing"
    man = load_json(mp)
    hashes = {}
    for fn, h in (man.get("file_hashes") or {}).items():
        fp = os.path.join(data_dir, fn)
        if not os.path.isfile(fp):
            hashes[fn] = "file missing"
            continue
        with open(fp, "rb") as f:
            hashes[fn] = hashlib.sha256(f.read()).hexdigest() == h
    return {"schema_version": man.get("schema_version"),
            "matches_config_schema_version": man.get("schema_version") == SCHEMA_VERSION,
            "dataset_version": man.get("dataset_version"),
            "split_sizes_in_manifest": man.get("split_sizes"),
            "split_sizes_actual": {sn: len(r) for sn, r in splits.items()},
            "file_hashes_match": hashes}


def replay_check(data_dir: str, all_recs: list) -> object:
    p = os.path.join(data_dir, "replay_buffer_manifest.json")
    if not os.path.isfile(p):
        return "missing"
    d = load_json(p)
    flat = json.dumps(d)
    return {"keys": sorted(d) if isinstance(d, dict) else _type_name(d),
            "mentions_any_sample_id": any(r.get("sample_id", "\0") in flat for r in all_recs),
            "content": _truncate(d)}


def data_checks(data_dir: str, bank: dict, evidence_n: int, seed: int) -> dict:
    splits = load_splits(data_dir)
    all_recs = [r for recs in splits.values() for r in recs]
    out = {"data_dir": data_dir, "splits_found": list(splits),
           "splits_missing": [s for s in SPLITS if s not in splits],
           "capacity": capacity(splits)}
    out.update(leakage(splits))
    out["numbered_text_matches_raw"] = numbering_check(all_recs)
    out["gold_vs_shared_validator"] = gold_check(all_recs)
    out["evidence_check"] = evidence_check(all_recs, bank, evidence_n, seed)
    out["execution_consistency"] = execution_check(data_dir, all_recs, bank)
    out["sft"] = sft_check(data_dir, all_recs)
    out["manifest"] = manifest_check(data_dir, splits)
    out["replay_buffer_manifest"] = replay_check(data_dir, all_recs)
    return out


# %%
# ============================================================================
# 4. CODE SCAN (repo scripts; text only, nothing is imported or executed)
# ============================================================================

_DUP_PATTERNS = [
    (r"^def validate_grading_output\(", "validate_grading_output"),
    (r"^SYSTEM_PROMPT\s*=", "SYSTEM_PROMPT"),
    (r"^def add_line_numbers\(", "add_line_numbers"),
    (r"^def build_exec_section\(", "build_exec_section"),
]


def _repo_code_files(repo: str) -> list:
    files = []
    for ext in CODE_EXTS:
        files += glob.glob(os.path.join(repo, "**", f"*{ext}"), recursive=True)
    keep = []
    for f in sorted(files):
        parts = os.path.relpath(f, repo).replace("\\", "/").split("/")
        if any(p.startswith(".") or p in ("node_modules", "__pycache__", "archive", "kaggle_bundle")
               for p in parts):
            continue
        keep.append(f)
    return keep


def code_scan(repo: str, artifact_names: list) -> dict:
    res = {"schema_version_literals": {}, "foreign_absolute_paths": {}, "kaggle_path_literals": {},
           "definitions": defaultdict(list), "imports_shared_src": [], "artifact_refs": {},
           "files_scanned": []}
    for f in _repo_code_files(repo):
        rel = os.path.relpath(f, repo).replace("\\", "/")
        try:
            with open(f, encoding="utf-8") as fh:
                text = fh.read()
        except (OSError, UnicodeDecodeError):
            continue
        res["files_scanned"].append(rel)
        sv = re.findall(r"""^\s*SCHEMA_VERSION\s*=\s*["']([^"']+)["']""", text, re.M)
        if sv:
            res["schema_version_literals"][rel] = sv
        fp = sorted(set(re.findall(r"[A-Za-z]:[/\\]{1,2}Users[/\\]{1,2}[^\s'\"`]+", text)))
        if fp:
            res["foreign_absolute_paths"][rel] = fp[:5]
        kp = sorted(set(re.findall(r"/kaggle/(?:working|input)[^\s'\"\)`]*", text)))
        if kp:
            res["kaggle_path_literals"][rel] = kp[:10]
        for pat, label in _DUP_PATTERNS:
            if re.search(pat, text, re.M):
                res["definitions"][label].append(rel)
        if re.search(r"^\s*from src[\. ]", text, re.M):
            res["imports_shared_src"].append(rel)
        refs = [a for a in artifact_names if a in text]
        if refs and rel != "n0_audit.py":   # the audit names every artifact; skip itself
            res["artifact_refs"][rel] = refs
    res["definitions"] = dict(res["definitions"])
    return res


# %%
# ============================================================================
# 5. PHASE STATUS (README section 3)
# ============================================================================

# (phase, name, code files that implement it, output file patterns it should produce)
PHASES = [
    (0, "Pipeline audit", ["n0_audit.py"], []),
    (1, "Dataset / synthetic samples", ["nb1_data.py"], ["train.jsonl", "data_manifest.json"]),
    (2, "OCR extraction + evaluation", ["nb2_ocr_eval.py", "archive/nb2_ocr_eval.py",
                                        "archive/phase1_ocr/run_experiment.py"],
     ["ocr_manifest_*.json"]),
    (3, "OCR quality control", ["src/qc.py", "n3_qc_calibration.py"], ["qc_thresholds.json"]),
    (4, "Teacher grading", ["n4_teacher.py"], ["predictions_teacher*.jsonl"]),
    (5, "Distillation / SFT", ["nb2_train.py"], ["train_config.json", "adapter_config.json"]),
    (6, "Evaluation", ["nb3_infer.py"], ["evaluation_results.csv", "evaluation_summary.md"]),
    (7, "Inference / user flow", ["n7_inference_demo.py"], ["*audit_trail*"]),
]


def phase_status(repo: str, found_basenames: list) -> list:
    rows = []
    for num, name, code, outputs in PHASES:
        code_found = [c for c in code if os.path.isfile(os.path.join(repo, c))]
        out_found = sorted({b for b in found_basenames for o in outputs if fnmatch.fnmatch(b, o)})
        if not code_found:
            status = "missing"
        elif not outputs:
            status = "partial: code found (this run writes its outputs)" if num == 0 else "partial: code found"
        elif not out_found:
            status = "partial: code only (no outputs in scanned folders)"
        else:
            status = "partial: code + outputs found (section 11 checks not run here)"
        rows.append({"phase": num, "name": name, "code_found": code_found,
                     "outputs_found": out_found[:6], "status": status})
    return rows


# %%
# ============================================================================
# 6. DEFECTS (derived only from the measured results above)
# ============================================================================

def code_defects(cs: dict) -> list:
    d = []
    lits = cs["schema_version_literals"]
    if lits:
        d.append(f"SCHEMA_VERSION hardcoded outside config/schema_version.txt "
                 f"(config says {SCHEMA_VERSION}): {lits}")
    for label, files in cs["definitions"].items():
        outside = [f for f in files if not f.startswith("src/")]
        if outside:
            d.append(f"`{label}` defined outside src/ in {outside} (README section 5: one copy only)")
    for f, p in cs["foreign_absolute_paths"].items():
        d.append(f"{f}: hardcoded absolute user path(s) {p}")
    return d


def file_defects(files: list) -> list:
    d = []
    for ifo in files:
        if ifo.get("n_invalid_lines"):
            d.append(f"{ifo['rel']}: {ifo['n_invalid_lines']} invalid JSONL line(s), e.g. {ifo['invalid_lines'][:2]}")
        if ifo["kind"] == "unreadable":
            d.append(f"{ifo['rel']}: unreadable ({ifo.get('error')})")
    return d


def data_defects(dc: dict) -> list:
    d = []
    if dc.get("splits_missing"):
        d.append(f"missing split files: {dc['splits_missing']}")
    for k, v in dc.get("program_overlap", {}).items():
        if v["programs"]:
            d.append(f"program leakage {k}: {v['programs']} shared program_ids, e.g. {v['examples']}")
    if dc.get("test_unseen_questions_also_in_other_splits"):
        d.append(f"test_unseen questions also in other splits: {dc['test_unseen_questions_also_in_other_splits']}")
    for sn, c in dc.get("capacity", {}).items():
        if c["n_duplicate_sample_ids"]:
            d.append(f"{sn}: {c['n_duplicate_sample_ids']} duplicate sample_ids")
    nt = dc.get("numbered_text_matches_raw", {})
    if nt.get("n") and nt["matches"] != nt["n"]:
        d.append(f"student_answer != add_line_numbers(student_answer_raw) in {nt['n'] - nt['matches']}/{nt['n']} records")
    g = dc.get("gold_vs_shared_validator", {})
    if g.get("n_fail"):
        d.append(f"{g['n_fail']}/{g['n']} gold labels fail the shared validator, e.g. {g['examples'][:2]}")
    ev = dc.get("evidence_check", {})
    for sl, s in (ev.get("by_noise") or {}).items():
        checked = s["criteria"] - s["no_mutation_text"]
        if checked and s["hit_shape"] < checked:
            d.append(f"evidence lines [{sl}]: {checked - s['hit_shape']}/{checked} cited lines do not "
                     "match the intended mutated line (see miss_examples)")
    ex = dc.get("execution_consistency", {})
    a = ex.get("execution_reports_vs_records")
    if isinstance(a, dict) and (a["missing_in_reports"] or a["equal"] != a["n_records"]):
        d.append(f"execution_reports.json disagrees with the records: {a}")
    b = ex.get("report_matches_shown_code")
    if isinstance(b, dict) and b["equal_to_stored_report"] != b["n"]:
        d.append(f"stored execution report != cached report for the shown code in "
                 f"{b['n'] - b['equal_to_stored_report']}/{b['n']} records")
    return d


def artifact_defects(dc: dict) -> list:
    d = []
    for sn, s in dc.get("sft", {}).items():
        if s == "missing":
            d.append(f"{sn}_sft.jsonl missing")
            continue
        n = s["n_rows"]
        if s["system_prompt_equals_current_src"] != n:
            d.append(f"{sn}_sft.jsonl: {n - s['system_prompt_equals_current_src']}/{n} rows have a system "
                     "prompt different from src.prompts (re-run NB1)")
        if s["target_equals_gold"] != n:
            d.append(f"{sn}_sft.jsonl: {n - s['target_equals_gold']}/{n} targets differ from gold in {sn}.jsonl")
        if set(s["schema_versions"]) != {SCHEMA_VERSION}:
            d.append(f"{sn}_sft.jsonl schema versions {s['schema_versions']} (config: {SCHEMA_VERSION})")
    m = dc.get("manifest")
    if m == "missing":
        d.append("data_manifest.json missing")
    elif isinstance(m, dict):
        if not m["matches_config_schema_version"]:
            d.append(f"data_manifest schema_version {m['schema_version']} != config {SCHEMA_VERSION}")
        bad = {k: v for k, v in m["file_hashes_match"].items() if v is not True}
        if bad:
            d.append(f"data_manifest file hashes do not match: {bad}")
        if m["split_sizes_in_manifest"] != m["split_sizes_actual"]:
            d.append(f"manifest split_sizes {m['split_sizes_in_manifest']} != actual {m['split_sizes_actual']}")
    return d


def derive_defects(report: dict) -> list:
    d = code_defects(report["code_scan"]) + file_defects(report["files"])
    if isinstance(report.get("data"), dict):
        d += data_defects(report["data"]) + artifact_defects(report["data"])
    else:
        d.append(f"dataset not audited: {report.get('data')}")
    return d


# %%
# ============================================================================
# 7. PIPELINE_MAP.md RENDERING
# ============================================================================

def _md(s) -> str:
    return str(s).replace("|", "\\|").replace("\n", " ")


def _contents(ifo: dict) -> str:
    if ifo["kind"] == "jsonl":
        keys = list(ifo["key_types"])
        s = f"JSONL, {ifo['n_records']} records; keys: {', '.join(keys[:12])}{' ...' if len(keys) > 12 else ''}"
    elif ifo["kind"] == "json":
        if ifo.get("layout") == "dict of objects":
            vk = list(ifo.get("value_key_types", {}))
            s = f"JSON object with {ifo['n_records']} entries; entry keys: {', '.join(vk[:10])}"
        elif ifo.get("layout") == "list":
            s = f"JSON list, {ifo['n_records']} items; keys: {', '.join(list(ifo['key_types'])[:10])}"
        else:
            s = f"JSON object; keys: {', '.join(list(ifo.get('key_types', {}))[:12])}"
    elif ifo["kind"] == "image_group":
        s = f"{ifo['n_images']} image files ({', '.join(ifo['exts'])})"
    else:
        s = f"{ifo['kind']}, {ifo['size_bytes']} bytes"
    if ifo.get("image_ref_fields"):
        s += f"; image/path fields: {', '.join(ifo['image_ref_fields'][:5])}"
    return s


def _mermaid(code_scan_res: dict) -> list:
    lines = ["```mermaid", "flowchart LR"]
    ids = {}

    def nid(name):
        if name not in ids:
            ids[name] = f"n{len(ids)}"
        return ids[name]
    for script, refs in sorted(code_scan_res["artifact_refs"].items()):
        for a in refs:
            lines.append(f'  {nid(script)}["{script}"] --- {nid("a:" + a)}(["{a}"])')
    lines.append("```")
    return lines


def render_markdown(rep: dict) -> str:
    L = ["# PIPELINE_MAP", "",
         f"Generated by `n0_audit.py` at {rep['created_utc']} UTC. Every value below was measured by the "
         "script from the files listed; nothing was filled in by hand. `not measured` means the input "
         "needed for that check was not available.", "",
         f"- Config schema version: `{SCHEMA_VERSION}`",
         f"- Dataset folder: `{rep['data_dir']}`",
         f"- Other scanned folders: {', '.join(f'`{d}`' for d in rep['scan_dirs'][1:]) or 'none'}",
         f"- Question bank: {rep['question_bank']}", "",
         "## 1. Files", "",
         "Role is inferred from the file's contents (basis column). 'Referenced by' lists repo scripts "
         "whose source contains the literal file name (reads and writes are not distinguished; names "
         "built at runtime are not detected).", "",
         "| File | What it actually contains | Role | Basis | Referenced by |",
         "|---|---|---|---|---|"]
    refs_by_name = defaultdict(list)
    for script, names in rep["code_scan"]["artifact_refs"].items():
        for n in names:
            refs_by_name[n].append(script)
    for ifo in rep["files"]:
        base = os.path.basename(ifo["rel"])
        L.append(f"| `{_md(ifo['rel'])}` | {_md(_contents(ifo))} | {_md(ifo['role'])} | "
                 f"{_md(ifo['role_basis'])} | {_md(', '.join(refs_by_name.get(base, [])) or '-')} |")
    if not rep["files"]:
        L.append("| (no files found) | | | | |")
    L += ["", f"Images referenced inside JSON/JSONL: "
          f"{'yes: ' + ', '.join(sorted({f for i in rep['files'] for f in i.get('image_ref_fields', [])})) if any(i.get('image_ref_fields') for i in rep['files']) else 'no image/path fields found'}.",
          f"Image files on disk: {sum(i.get('n_images', 0) for i in rep['files'])}.", "",
          "## 2. Data flow (scripts and the artifacts they mention)", "",
          "Edges mean 'the script's source contains this file name'. Names built at runtime "
          "(e.g. f\"{split}.jsonl\") are not detected, so missing edges are possible.", ""]
    L += _mermaid(rep["code_scan"])
    L += ["", "## 3. Phase status", "",
          "'complete' requires the README section 11 acceptance checks, which this audit does not run.", "",
          "| Phase | Name | Status | Code found | Outputs found |", "|---|---|---|---|---|"]
    for p in rep["phases"]:
        L.append(f"| {p['phase']} | {p['name']} | {p['status']} | {', '.join(p['code_found']) or '-'} | "
                 f"{', '.join(p['outputs_found']) or '-'} |")
    L += render_data_section(rep.get("data"))
    L += ["", "## 5. Defects found", ""]
    L += [f"{i}. {_md(x)}" for i, x in enumerate(rep["defects"], 1)] or ["None found by the measured checks."]
    L += ["", "## 6. Example records (truncated)", ""]
    for ifo in rep["files"]:
        if ifo.get("examples"):
            L.append(f"**{ifo['rel']}**")
            L += [f"- `{_md(e)}`" for e in ifo["examples"]]
            L.append("")
    return "\n".join(L) + "\n"


def render_data_section(dc) -> list:
    L = ["", "## 4. Data checks", ""]
    if not isinstance(dc, dict):
        return L + [f"not measured: {dc}"]
    L += ["| Split | Samples | Distinct programs | Renderings/program (min/median/max) | Questions | "
          "Review rate (n) | Garbled | Heavy OCR | unseen_kind |", "|---|---|---|---|---|---|---|---|---|"]
    for sn, c in dc["capacity"].items():
        r = c["renderings_per_program"]
        L.append(f"| {sn} | {c['n_samples']} | {c['n_distinct_programs']} | {r['min']}/{r['median']}/{r['max']} | "
                 f"{c['n_distinct_questions']} | {c['review_rate']:.1%} ({c['n_review']}) | {c['n_garbled']} | "
                 f"{c['n_heavy_ocr']} | {_md(c['unseen_kind'])} |")
    L += ["", "Cross-split program overlap: " +
          ("; ".join(f"{k}: {v['programs']}" for k, v in dc["program_overlap"].items()) or "n/a"),
          f"test_unseen questions also in other splits: {dc.get('test_unseen_questions_also_in_other_splits', 'n/a')}",
          "", "Numbered text = add_line_numbers(raw): "
          f"{dc['numbered_text_matches_raw']['matches']}/{dc['numbered_text_matches_raw']['n']}",
          f"Gold labels passing the shared validator: "
          f"{dc['gold_vs_shared_validator']['n'] - dc['gold_vs_shared_validator']['n_fail']}/"
          f"{dc['gold_vs_shared_validator']['n']}", "", "**Evidence-line check**", ""]
    ev = dc["evidence_check"]
    if ev["status"] != "measured":
        L.append(f"not measured: {ev['reason']}")
    else:
        L += [f"{ev['n_records_sampled']} of {ev['n_records_with_evidence']} records with evidence lines "
              f"sampled (seed {ev['seed']}). {ev['note']}", "",
              "| Noise | Criteria with evidence | No expected line | Hit (exact) | Hit (renaming-invariant) |",
              "|---|---|---|---|---|"]
        for sl, s in ev["by_noise"].items():
            L.append(f"| {sl} | {s['criteria']} | {s['no_mutation_text']} | {s['hit_exact']} | {s['hit_shape']} |")
    L += ["", "**Execution reports**", ""]
    for k, v in dc["execution_consistency"].items():
        L.append(f"- {k}: `{_md(json.dumps(v) if isinstance(v, dict) else v)}`")
    L += ["", "**SFT files**", ""]
    for sn, v in dc["sft"].items():
        L.append(f"- {sn}_sft.jsonl: `{_md(json.dumps(v) if isinstance(v, dict) else v)}`")
    m = dc["manifest"]
    L += ["", f"**Manifest**: `{_md(json.dumps(m) if isinstance(m, dict) else m)}`", "",
          f"**replay_buffer_manifest.json**: `{_md(json.dumps(dc['replay_buffer_manifest']))}`",
          "Its role is not stated by its contents alone; check which code reads it before relying on it."]
    return L


# %%
# ============================================================================
# 8. MAIN
# ============================================================================

def collect_files(scan_dirs: list, out_dir: str) -> list:
    """Inspect every file; images are grouped per folder. Our own outputs are skipped."""
    own = {os.path.abspath(os.path.join(out_dir, n)) for n in ("PIPELINE_MAP.md", "audit_report.json")}
    infos = []
    for root_dir in scan_dirs:
        for dirpath, _dirs, files in os.walk(root_dir):
            imgs = Counter()
            for fn in sorted(files):
                p = os.path.join(dirpath, fn)
                if os.path.abspath(p) in own:
                    continue
                if fn.lower().endswith(IMAGE_EXTS):
                    imgs[os.path.splitext(fn)[1].lower()] += 1
                    continue
                ifo = inspect_file(p)
                ifo["rel"] = os.path.relpath(p, os.path.dirname(root_dir.rstrip("/\\")) or ".").replace("\\", "/")
                infos.append(ifo)
            if imgs:
                rel = os.path.relpath(dirpath, os.path.dirname(root_dir.rstrip("/\\")) or ".").replace("\\", "/")
                infos.append({"path": dirpath, "rel": rel + "/*", "kind": "image_group", "size_bytes": 0,
                              "n_images": sum(imgs.values()), "exts": sorted(imgs)})
    return infos


def _default_data_dir():
    try:
        return _paths.resolve_data_dir(), None
    except (FileNotFoundError, RuntimeError) as e:
        return None, str(e)


def parse_args(argv=None):
    ap = argparse.ArgumentParser(description="Phase 0 pipeline audit (writes PIPELINE_MAP.md + audit_report.json)")
    ap.add_argument("--data-dir", help="NB1 dataset folder (default: src.paths.resolve_data_dir())")
    ap.add_argument("--scan-dir", action="append", default=[],
                    help="extra folder to inventory (OCR results, images, training output); repeatable")
    ap.add_argument("--out-dir", default="/kaggle/working" if os.path.isdir("/kaggle/working") else REPO_ROOT)
    ap.add_argument("--nb1", default=os.path.join(REPO_ROOT, "nb1_data.py"),
                    help="NB1 source, parsed (not executed) for the question bank")
    ap.add_argument("--evidence-sample", type=int, default=200)
    ap.add_argument("--seed", type=int, default=42)
    args, _unknown = ap.parse_known_args(argv)   # tolerate Jupyter's own argv
    return args


def main(argv=None) -> dict:
    args = parse_args(argv)
    data_dir, data_err = (args.data_dir, None) if args.data_dir else _default_data_dir()
    if data_dir and not os.path.isdir(data_dir):
        data_dir, data_err = None, f"--data-dir {args.data_dir} does not exist"

    scan_dirs = [data_dir] if data_dir else []
    for extra in [os.path.join(_paths.base_dir(), "ocr_results"), os.path.join(_paths.base_dir(), "output")]:
        if os.path.isdir(extra) and extra not in args.scan_dir:
            args.scan_dir.append(extra)
    missing_scan = [d for d in args.scan_dir if not os.path.isdir(d)]
    scan_dirs += [d for d in args.scan_dir if os.path.isdir(d)]

    bank = parse_question_bank(args.nb1)
    n_q = len([k for k in bank if not k.startswith("_")])
    bank_desc = (f"not available ({bank['_error']})" if "_error" in bank
                 else f"{n_q} questions parsed from `{os.path.relpath(args.nb1, REPO_ROOT)}`"
                 + (f"; {len(bank['_partial_errors'])} could not be parsed" if "_partial_errors" in bank else ""))

    data = data_checks(data_dir, bank, args.evidence_sample, args.seed) if data_dir else f"no dataset: {data_err}"
    split_ids = set()
    if data_dir:
        for recs in load_splits(data_dir).values():
            split_ids |= {r.get("sample_id") for r in recs}

    files = collect_files(scan_dirs, args.out_dir)
    for ifo in files:
        ifo["role"], ifo["role_basis"] = infer_role(ifo, split_ids)

    artifact_names = sorted({os.path.basename(i["rel"]) for i in files if i["kind"] != "image_group"}
                            | {"train.jsonl", "val.jsonl", "test_seen.jsonl", "test_unseen.jsonl",
                               "train_sft.jsonl", "val_sft.jsonl", "data_manifest.json",
                               "exec_cache.json", "execution_reports.json", "replay_buffer_manifest.json",
                               "train_config.json", "best_adapter"})
    cs = code_scan(REPO_ROOT, artifact_names)
    rep = {"created_utc": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()),
           "schema_version": SCHEMA_VERSION, "repo_root": REPO_ROOT,
           "data_dir": data_dir or f"not found ({data_err})", "scan_dirs": scan_dirs,
           "scan_dirs_missing": missing_scan, "question_bank": bank_desc,
           "seed": args.seed, "files": files, "data": data, "code_scan": cs,
           "phases": phase_status(REPO_ROOT, [os.path.basename(i["rel"]) for i in files])}
    rep["defects"] = derive_defects(rep) + [f"scan folder not found: {d}" for d in missing_scan]

    os.makedirs(args.out_dir, exist_ok=True)
    md_path = os.path.join(args.out_dir, "PIPELINE_MAP.md")
    js_path = os.path.join(args.out_dir, "audit_report.json")
    with open(js_path, "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=2, ensure_ascii=False, default=str)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(render_markdown(rep))

    print(f"Dataset folder : {rep['data_dir']}")
    print(f"Files inspected: {len(files)}")
    print(f"Question bank  : {bank_desc}")
    print(f"Defects found  : {len(rep['defects'])}")
    for i, x in enumerate(rep["defects"], 1):
        print(f"  {i:2d}. {x[:200]}")
    print(f"\nWrote {md_path}\nWrote {js_path}")
    return rep


if __name__ == "__main__":
    main()
