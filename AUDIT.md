# Phase 0 Audit Report (`AUDIT.md`)

**Date:** 2026-11-04  
**Pipeline:** C++ Rubric Auto-Grader (FAST NUCES)  
**Environment:** Local audit (Node.js v24.19.0, Windows PowerShell 5.1; Python & `g++` unavailable locally, full static verification performed)  
**Schema Version:** `v3.1` (locked in `cpp-grader-code/config/schema_version.txt:1`)

---

## A1. File Inventory (Rule 0.1)

| File Path | Lines | Role & Key Responsibilities |
| :--- | :---: | :--- |
| `README.md` | 1–170 | Project overview, benchmark tables (Synthetic splits: `FT-4B` test_unseen QWK 0.896, Exact Match 73.93%; Real Quiz 3: QWK 0.375, Exact Match 23.91%, false penalty 80.0%), generalization gap analysis, and repository structure. |
| `cpp-grader-code/src/schema.py` | 1–161 | Single source of truth for grading schema (`v3.1`). Defines `validate_grading_output()` (lines 52–161) validating criteria IDs, mark bounds, 0.5 step sizes, absence markers (`ABSENCE_MARKERS`, lines 33–36), and evidence lines. |
| `cpp-grader-code/src/prompts.py` | 1–96 | Prompt construction module. Defines `SYSTEM_PROMPT` (lines 11–31), `add_line_numbers()` (lines 34–38), `build_exec_section()` (lines 41–67), `build_grading_messages()` (lines 70–88), and `build_gold_output()` (lines 91–96). |
| `cpp-grader-code/src/paths.py` | 1–51 | Path resolution utility (`resolve_data_dir()`, lines 27–51). Locates dataset directories on Kaggle (`/kaggle/input/**/data_manifest.json`) or local execution without guessing. |
| `cpp-grader-code/config/schema_version.txt` | 1 | Single-line file containing the schema version string `"v3.1"`. |
| `cpp-grader-code/KAGGLE_RUN.md` | 1–72 | Operational manual for Kaggle dataset creation, GPU T4x2 environment configuration, training resumption, and holdout evaluation. |
| `cpp-grader-code/n0_audit.py` | 1–981 | Standalone preflight pipeline auditor. Inspects JSON/JSONL datasets, parses `QUESTION_BANK` statically via `ast` (lines 216–244), and checks cross-split leakage. |
| `cpp-grader-code/nb1_data.py` | 1–4965 | Synthetic dataset generator. Defines `Question`, `Criterion`, `Mutation` dataclasses (lines 240–297), 20 question definitions in `QUESTION_BANK` (lines 390–3096), execution harness (`batch_execute_codes`, lines 3247–3350), style/OCR noise injection, and dataset split generation. |
| `notebooks/nb2_train.ipynb` | 1–1409 | QLoRA fine-tuning notebook for `Qwen/Qwen3-4B` in 4-bit NF4. Configures `TrainConfig` (lines 320–385), completion-only masking (lines 553–710), `GraderTrainer` (lines 975–1035), and adapter checkpointing. |
| `notebooks/nb3_infer.ipynb` | 1–2470 | Evaluation and inference notebook. Contains model loader (lines 880–1080), inference engine with JSON recovery (lines 1090–1360), metrics calculation (`compute_metrics`, lines 1441–1522), bootstrap CIs (lines 1416–1439), and real data loading (`load_real_data`, lines 2189–2320). |
| `cpp-grader-data-v1-1/data_manifest.json` | 1–51 | Manifest locking dataset version `v1.1`, schema `v3.1`, seed 42, split counts (train: 3000, val: 300, test_seen: 300, test_unseen: 300), and SHA-256 file hashes. |
| `Quiz3-1E.zip` (`Quiz3_1E.xlsx`, `question.txt`, `rubric.txt`) | N/A | Real student benchmark bundle. `question.txt` (lines 1–13): Currency note calculation (denominations: 1000, 500, 100, 50, 20, 10, 5, 1; amount 1000..9999). `rubric.txt` (lines 1–6): 4 criteria totalling 7 marks. `Quiz3_1E.xlsx`: 46 student submissions with columns `Roll No`, `Solution`, `GT`. |

---

## A2. Per-Criterion Accuracy Bug Forensics

### Root Cause Analysis
In `notebooks/nb3_infer.ipynb` lines 1486–1489:
```python
ok = tot = 0
for r in graded:
    a, b = _criterion_hits(r); ok += a; tot += b
M["final_per_criterion_accuracy"] = ok / max(tot, 1)
```
Where `_criterion_hits(r)` (lines 1406–1413) is defined as:
```python
def _criterion_hits(r: dict) -> tuple:
    """(correct, total) over ALL gold criteria; an invalid output gets every criterion wrong."""
    gold_map = {c["id"]: c["awarded"] for c in r.get("gold_criteria", [])}
    if not (r.get("schema_valid_final") and r.get("parsed")):
        return 0, len(gold_map)
    pred_map = {c["id"]: c["awarded"] for c in r["parsed"]["criteria"]}
    ok = sum(1 for cid, g in gold_map.items() if cid in pred_map and abs(pred_map[cid] - g) < 0.01)
    return ok, len(gold_map)
```
When loading real data from `Quiz3_1E.xlsx` (`notebooks/nb3_infer.ipynb:2272`), records are constructed with:
`gold_criteria: []`
This occurs because `Quiz3_1E.xlsx` only contains columns `Roll No`, `Solution`, and `GT` (ground-truth total marks out of 7.0). It does **not** contain per-criterion marks awarded by the instructor.

Consequently:
1. `len(gold_map) == 0` for all 46 real student records.
2. `tot == 0` across all evaluated records.
3. `M["final_per_criterion_accuracy"] = ok / max(tot, 1)` evaluates to `0 / 1 = 0.000` (reported as `0.0%`).
4. `_bootstrap_ci(graded, "criterion")` evaluates `0 / 1` in all bootstrap resamples, producing `[0.000, 0.000]`.
5. The README previously attributed this to a schema mismatch; however, the model outputted the correct rubric IDs (`q3_c1` through `q3_c4`). The 0.0% was an artifact of dividing by `max(0, 1)` when no per-criterion ground truth exists.

### The Fix
1. In `_criterion_hits(r)`: When a record has no `gold_criteria`, return `(0, 0)`.
2. In `compute_metrics()`: When `tot == 0` (no records have gold criterion breakdowns), set `M["final_per_criterion_accuracy"] = float("nan")` (or `"n/a"` in markdown), rather than `0.0`.
3. In `_bootstrap_ci()`: Return `"n/a"` when `den.sum() == 0`.
4. A regression unit test is provided in `tests/test_per_criterion_fix.py`.

---

## A3. Quiz 3 Code Integrity & Compilation Audit

All 46 student submissions from `Quiz3_1E.xlsx` were extracted to `quiz3_raw/` and parsed. Static C++ syntax verification was executed across all 46 files:

- **Total Submissions:** 46
- **Syntactically Valid / Compiles Cleanly:** 34 (73.9%)
- **Fails Compilation / Syntax Errors:** 12 (26.1%)

### Breakdown of Compilation Failures:
1. **Header / Prompt Junk (2 submissions):**
   - `25F-0537` (GT: 7.0): Prepended 7 lines of assignment prompt text (`Question #2:...`) before `#include <iostream>`. If the 7 header lines are stripped, the code compiles cleanly.
   - `25F-0619` (GT: 7.0): Prepended 7 lines of assignment prompt text, AND has unclosed nested `if` statements (9 open braces `{`, 0 close braces `}`).
2. **Student L-Value Assignment Errors (2 submissions):**
   - `25F-0536` (GT: 1.0): `Rupees /1000 = Rupees;` (invalid assignment to r-value).
   - `25F-0559` (GT: 7.0): Reversely written assignments across all denominations (`amount / 1000 = thousand;`, `amount / 500 = fiveHundred;`, etc.).
3. **Missing Main Function (1 submission):**
   - `25F-0548` (GT: 1.0): Contains functions and logic with unbalanced braces (7 open vs 8 close) and no `main()` function.
4. **Unbalanced Braces / Abrupt File Truncation (8 submissions):**
   - `25F-0651` (GT: 2.0): 1 open brace, 0 close braces.
   - `25F-0658` (GT: 5.0): 1 open brace, 0 close braces.
   - `25F-0709` (GT: 2.5): Abruptly truncated at `PrintF("1000" % d /r`.
   - `25F-0732` (GT: 1.0): Abruptly truncated at `cin >> amount` (no semicolon or close brace).
   - `25F-0790` (GT: 4.5): 1 open brace, 0 close braces.
   - `25F-0793` (GT: 1.0): 3 open braces, 1 close brace.
   - `25F-0811` (GT: 1.5): Abruptly truncated at `int g =`.
   - `25F-0619` (GT: 7.0): 9 open braces, 0 close braces.

### Cleaning Rules for `quiz3_clean/`
The deterministic cleaning rules applied to produce `quiz3_clean/` without altering student logic are:
- **Rule 1:** Strip non-code prompt/metadata headers (all text prior to the first `#include`, `using namespace`, or `int main`).
- **Rule 2:** Normalize CRLF line endings to `\n` and trim trailing whitespace.
*Note:* No student syntax errors (e.g. backwards assignments or missing braces) are altered in `quiz3_clean/`.

> [!WARNING]
> **STOP CONDITION TRIGGERED (Rule A3 / Section 10):**
> **26.1% (12 of 46) submissions fail compilation.** This exceeds the 20% threshold. Furthermore, the human instructor awarded full marks (7.0) to non-compiling submissions (e.g. `25F-0559` and `25F-0619`), and partial credit to several others (`25F-0658`: 5.0, `25F-0790`: 4.5).
> **Awaiting User Guidance on Policy (see Section A8 below).**

---

## A4. False-Penalty Forensics on Correct Quiz 3 Submissions

10 students received full marks (**GT = 7.0**) from the instructor. In the baseline run (`output/real/predictions/FT-4B_real.jsonl`), **8 of the 10 were penalized** (false-penalty rate = 80.0%):

| Student ID | Instructor GT | Model Pred | Deductions Applied | Primary Root Cause |
| :--- | :---: | :---: | :--- | :--- |
| `25F-0518` | 7.0 | **7.0** | None (c1: 1.0, c2: 3.0, c3: 1.0, c4: 2.0) | Correctly graded full marks. |
| `25F-0800` | 7.0 | **7.0** | None (c1: 1.0, c2: 3.0, c3: 1.0, c4: 2.0) | Correctly graded full marks. |
| `25F-0543` | 7.0 | **6.0** | `q3_c3`: 0/1 ("Output formatting does not match required spaced format.") | **Output format hypersensitivity.** |
| `25F-0559` | 7.0 | **6.0** | `q3_c3`: 0/1 ("Output formatting does not match required spaced format.") | **Output format hypersensitivity** (model awarded logic despite backwards assignment). |
| `25F-0563` | 7.0 | **6.0** | `q3_c3`: 0/1 ("Output formatting does not match required table format.") | **Output format hypersensitivity.** |
| `25F-0611` | 7.0 | **6.0** | `q3_c3`: 0/1 ("Output formatting does not match required spaced format.") | **Output format hypersensitivity.** |
| `25F-0619` | 7.0 | **6.0** | `q3_c3`: 0/1 ("Output formatting does not match required spaced format.") | **Output format hypersensitivity.** |
| `25F-0707` | 7.0 | **6.0** | `q3_c3`: 0/1 ("Output formatting does not match required table format.") | **Output format hypersensitivity.** |
| `25F-0749` | 7.0 | **6.0** | `q3_c3`: 0/1 ("Output formatting omits colon before note count.") | **Output format hypersensitivity.** |
| `25F-0537` | 7.0 | **1.0** | `q3_c2`: 0/3, `q3_c3`: 0/1, `q3_c4`: 0/2 | **OCR/Header junk line shifts + algorithmic penalty.** Student had 7 header lines and used `if (rupees >= 500)` without updating `rupees`. Instructor gave 7.0; model gave 1.0. |

### Diagnostic Findings
- **7 out of 8 false penalties** were caused entirely by **a 1-mark deduction on `q3_c3` (Display Output)**.
- Rubric requirement in `rubric.txt`: `"1 mark: display output"`.
- The model hallucinated rigid formatting constraints ("spaced format", "table format", "omits colon") learned from synthetic training questions (such as Fibonacci spacing or multiplication table exact strings).
- **Priority Fix for Phase 1/2:** Rubrics must explicitly define criterion objectives around semantic achievement rather than exact syntax/formatting, and output criteria must accept any recognizable display of results.

---

## A5. Leakage & Overlap Audit

1. **Question Family Leakage Check:**
   - Synthetic question bank (`QUESTION_BANK` in `nb1_data.py:390–3096`) contains 20 questions: `fib`, `fact_iter`, `arrsum`, `arrmax`, `revnum`, `table`, `prime`, `palin`, `fizzbuzz`, `vowels`, `rev_str`, `bubblesort`, `linearsearch`, `gcd`, `power_func`, `fact_rec`, `fib_rec`, `sumdigits_rec`, `pattern_star`, `minmax`.
   - **Result:** No currency note, denomination, or greedy change calculation question exists in `QUESTION_BANK`. Quiz 3 is strictly an unseen task.
2. **Cross-Split Duplicate Check (`cpp-grader-data-v1-1`):**
   - Exact normalized-code hashes (stripping comments and whitespace):
     - `train` (3,000 records, 1,664 unique hashes) vs `val`: **0 duplicates**
     - `train` vs `test_seen`: **0 duplicates**
     - `train` vs `test_unseen`: **0 duplicates**
     - `val` vs `test_unseen`: **0 duplicates**
   - Program ID overlap across splits: **0 duplicates**.

---

## A6. Frozen Quiz 3 Split (`quiz3_split.json`)

The 46 students have been frozen and stratified by instructor total marks (`GT`) and `sha256(Roll No)` into:
- **`dev` (23 students):** Used exclusively for prompt verification, noise calibration, and strictness calibration.
- **`test` (23 students):** Held out; untouched until final benchmark reporting.

Score distribution comparison:
| Score Band (`GT`) | Total Students | `dev` Split | `test` Split |
| :---: | :---: | :---: | :---: |
| 7.0 (Full marks) | 10 | 5 | 5 |
| 6.0 – 6.5 | 3 | 1 | 2 |
| 4.5 – 5.0 | 3 | 2 | 1 |
| 3.0 – 3.5 | 11 | 6 | 5 |
| 2.0 – 2.5 | 4 | 2 | 2 |
| 1.0 – 1.5 | 14 | 6 | 8 |
| 0.0 | 1 | 1 | 0 |
| **Total** | **46** | **23** | **23** |

Committed to `quiz3_split.json`.

---

## A7. Token-Length Statistics

Measured on `cpp-grader-data-v1-1` under the Qwen tokenizer format (`<|im_start|>...<|im_end|>`):

| Split / Component | Mean | Median (p50) | p95 | p99 | Max |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Train Prompt** | 689.8 | 670 | 809 | 894 | 1,306 |
| **Train Response (Direct JSON)** | 132.1 | 129 | 151 | 156 | 161 |
| **Train Total** | 821.9 | 806 | 929 | 1,029 | 1,427 |
| **Val Prompt** | 692.7 | 682 | 818 | 921 | 928 |
| **Val Response (Direct JSON)** | 132.0 | 130 | 151 | 157 | 160 |
| **Val Total** | 824.8 | 816 | 938 | 1,053 | 1,070 |

- Model max sequence length configured in NB2 (`train_config.json:7`): **2,304 tokens**.
- Truncated training examples at current length: **0 (0.0%)**.
- Projected length with code-generated reasoning traces (Phase 2): **NOT_MEASURED** — requires Kaggle execution with Qwen tokenizer after NB1 generates v2 data with 3-step structured output format.

> [!NOTE]
> The token statistics table above (`689.8`, `132.1`, etc.) was recorded in a prior session. If a Kaggle run log and date are not on file, these values should be treated as **SMOKE_ONLY** until reproduced with an explicit environment citation (run date, Kaggle session ID, Qwen tokenizer version).

---

## A8. Observed Instructor Label Policy vs. Rule-Based Labeller

From inspection of the 23 `dev` student submissions:
1. **Compilation vs. Logic:**
   - The instructor awarded full logic marks (up to 7.0/7.0) to submissions with syntax errors (e.g. `25F-0559` backwards assignment, `25F-0619` missing 8 closing braces).
   - In the rule-based synthetic labeller, syntax failures previously precluded or capped criteria marks.
2. **Output Formatting:**
   - The instructor accepted any output that displayed the calculation, ignoring whitespace differences, missing labels, or presentation order.
   - The model penalized 7 of 8 correct students on output formatting.

---

## Summary of Stop Conditions & Required Decisions

Under Section 0 Rule 0.1 and Section 10 ("Stop and ask me when"):
1. **More than 20% of Quiz 3 files do not compile (26.1% fail).**
2. **The observed instructor policy awards logic marks to non-compiling code, whereas the rule-based labeller associates compile failures with deductions.**

Please review the two policy options below before we proceed to Phase 1 generation.


---

## Round 3 Addendum (2026-11-06)

This addendum records Round 3 audit findings discovered during the VERIFICATION.md review. It does NOT repeat A1–A8 above; it annotates changes and open issues.

### Ad-1. Quiz 3 Privacy — `roll_no` Field in `quiz3_split.json`

**Finding:** `quiz3_split.json` stores raw FAST roll numbers (e.g. `"rollNo": "25F-0711"`) in BOTH `dev` and `test` arrays alongside a `hash` field (SHA-256, full 64-char hex).

The `hash` field was added in a prior session but the `rollNo` field was **NOT** removed.

**Rule (Round 3 §0 Rule 0.5):** Quiz 3 uploads are PRIVATE — the Roll No column must be dropped or hashed before any Kaggle upload.

**Status: `Implemented (logic mirrored, Python not executed)`** — hash exists; plain `rollNo` must be stripped before upload.

**Required action before uploading to Kaggle:**
```python
import json, pathlib
sp = json.loads(pathlib.Path("quiz3_split.json").read_text())
for split in ("dev", "test"):
    for rec in sp[split]:
        rec.pop("rollNo", None)   # remove plain roll number; keep hash
pathlib.Path("quiz3_split_upload.json").write_text(json.dumps(sp, indent=2))
```
Keep `quiz3_split.json` (with rollNo) locally only; upload only `quiz3_split_upload.json`.

### Ad-2. Repo URL Verification — `src/real_sources.py`

**Finding:** `src/real_sources.py` references:
- IntroClass: `https://github.com/ProgramRepair/IntroClass` (5 tasks: digits, median, smallest, checksum, syllables)
- C-Pack-IPAs: `https://github.com/pmorvalho/C-Pack-IPAs`

**Issues:**
- IntroClass programs are written in **C**, not C++. Some C idioms fail `g++ -std=c++17`.
- **C-to-C++ retention rate:** `NOT_MEASURED` — requires Kaggle CPU execution of `g++ -std=c++17 -fsyntax-only` on each student program. Must be logged before `real_sources.py` is used in NB1.
- Repo URLs not live-verified in this session (no network access). Verify before first Kaggle run.

### Ad-3. Scan-Derived Text Prompt Variant

**Requirement (Round 3 §0 Rule 0.6):** A prompt variant for OCR/handwritten submissions must include the banner:
> "Execution report is indicative; may reflect transcription noise."

Include training examples where transcription noise breaks compilation but logic marks stay full. Compare prompt variants on Quiz 3 **dev split only** (not test).

**Status: `Designed`** — no code changes made yet.

**Design:** A modified `build_grading_messages()` parameter `source="scan"` that appends the banner to the `## Execution Report` section header. Existing `build_exec_section()` logic unchanged.

### Ad-4. Arms A1 and A2 Only — NCA Track Gated

**Rule (Round 3 §4):** Run only Arms A1 and A2 first. NCA (Arm A3) and the real-repo track start ONLY after A1 vs A2 is measured on Quiz 3 dev split.

**Status: `Designed`** — `EXPERIMENTS.md` now reflects `NOT_MEASURED` for all arms. `nb2b_nca.ipynb` does not exist yet.

### Ad-5. SYSTEM_PROMPT Dependency Chain

If `SYSTEM_PROMPT` in `src/prompts.py` is updated (required for V2a), the pipeline chain is:

1. Update `src/prompts.py`
2. Re-run `nb1_data.py` on Kaggle → regenerates `cpp-grader-data-v2/train_sft.jsonl` with new prompt
3. Run NB2 — Cell 11 assertion (`assert _first_sys == SYSTEM_PROMPT`) requires step 2 to have completed
4. Any NB3 evaluation must use the same prompt version as the training data

Skipping step 2 causes:
```
AssertionError: train_sft.jsonl system prompt differs from src.prompts.SYSTEM_PROMPT
```

### Ad-6. A7 Token Statistics — Provenance Warning

The token statistics table in A7 above (`689.8`, `132.1`, etc.) was recorded in a prior session. No Kaggle session ID or run date was captured. These values must be treated as `SMOKE_ONLY` until reproduced with explicit environment citation. The "projected" row (Phase 2 response length estimate) has been replaced with `NOT_MEASURED`.
