# VERIFICATION.md — Round 3 Pre-Flight Checklist

**Generated:** 2026-11-06  
**Environment:** Local Windows (Node.js v24.19.0; Python & `g++` unavailable locally)  
**Rule:** Every item labelled with exactly one of: `Designed` / `Implemented` / `Executed` / `Verified`  
**JS-verified items:** Labelled `Implemented (logic mirrored, Python not executed)`

> [!IMPORTANT]
> No item may be promoted to `Executed` or `Verified` until real Python code runs on Kaggle and output is inspected. All `Implemented` statuses reflect static JS/lezer AST syntax checks and static analyses.

---

## V1 — No Clamping in `src/parse.py` or NB3

**Requirement (Round 3 §0 Rule 0.1 + §1.2):** Out-of-range awarded marks (`< 0` or `> max_marks`) must NEVER be silently clamped. They must be logged as `out_of_range` compliance failures and flagged for human review. The raw (unclamped) value must be kept.

**Status: ✅ FIXED — `Implemented (logic mirrored, Python not executed)`**  
*(Fix applied 2026-11-06 — clamp removed from NB3 Cell 16, out_of_range logging added)*

**Evidence:**
- `notebooks/nb3_infer.ipynb` Cell 16: `awarded = max(0.0, min(awarded, max_m))` removed. Replaced with out-of-range checking that appends to `errors` and increments `result["out_of_range_count"]`.
- `cpp-grader-code/src/parse.py`: `ParseResult` class stores raw values and validates bounds without clamping.
- `cpp-grader-code/src/schema.py`: `validate_grading_output()` flags out-of-range marks without clamping.

---

## V2 — No Syntax Gate or Penalty in Prompts, Mutations, Schema

**Requirement (Round 3 §1.1):** Syntax errors, compilation failures, missing headers, void main, spelling mistakes, variable naming choices MUST NEVER penalise logic marks. The SYSTEM_PROMPT must explicitly instruct the model to treat broken syntax as valid and infer logical intent.

**Status: ✅ FIXED — `Implemented (logic mirrored, Python not executed)`**

**Evidence by sub-item:**

| Sub-item | Status | Evidence |
|----------|--------|---------|
| **V2a** SYSTEM_PROMPT exact CRE language | ✅ FIXED | `cpp-grader-code/src/prompts.py` lines 12–34: Enforces Pure-Logic CRE. Mandated exact text incorporated: *"IGNORE all syntax errors, compilation issues, missing headers, missing semicolons, spelling mistakes in text/identifiers, and variable naming choices. Treat broken syntax as valid syntax and infer the student's underlying C++ algorithmic logic and intention."* |
| **V2b** Execution report purely informational | ✅ FIXED | `cpp-grader-code/src/prompts.py` `build_exec_section()`: Decoupled from logic marks. Includes note: *"Execution report is purely informational. Non-compiling code or runtime errors caused by syntax/typing slips must NOT penalize logical rubric criteria."* Supports scan-derived text variant (`is_scan=True`). |
| **V2c** Syntax-error immunity mutations | ✅ FIXED | `cpp-grader-code/src/mutations.py`: 8 label-preserving transforms added (`inject_void_main`, `inject_missing_include`, `inject_drop_semicolons`, `inject_drop_closing_brace`, `inject_student_header`, `inject_misspelled_identifiers`, `inject_urdu_identifiers`, `inject_cout_spelling_noise`). Quiz 3 denomination constants purged from `inject_wrong_constant`. |
| **V2d** Schema compile-check policy | ✅ Correct | `cpp-grader-code/src/schema.py` lines 168–171: compile-failure checks apply strictly to criteria with explicit `"comp"`, `"syntax"`, or `"compile"` IDs. |
| **V2e** NB1 labeller compile-agnostic | NOT_MEASURED | Requires Kaggle CPU execution of `nb1_data.py`. |

---

## V3 — Qwen3 Thinking Tokens Locked Off (`enable_thinking=False`)

**Requirement (Round 3 §0 Rule 0.3):** Every call to `apply_chat_template` must pass `enable_thinking=False`. Without this, Qwen3 models emit `<think>...</think>` blocks that break JSON extraction.

**Status: ✅ FIXED — `Implemented (logic mirrored, Python not executed)`**  
*(Fix applied 2026-11-06 — `enable_thinking=False` with `try/except TypeError` pattern implemented across all code and notebooks).*

**Evidence:**
- `cpp-grader-code/nb1_data.py` line 4938: `apply_chat_template(msgs, tokenize=False, enable_thinking=False)`.
- `notebooks/nb1b_teacher.ipynb`: `enable_thinking=False` in teacher prompts and token statistics.
- `notebooks/nb2_train.ipynb`: Cells 4, 9, 12, 17, 20, 24 all have `enable_thinking=False`.
- `notebooks/nb2b_nca.ipynb`: `enable_thinking=False` configured.
- `notebooks/nb3_infer.ipynb`: Cell 15 includes `enable_thinking=False` with fallback.

---

## V4 — Explicit Adapter Path in NB3 (No Auto-Discovery)

**Requirement (Round 3 §0 Rule 0.4 + Round 2 Amendment):** `CFG.adapter_path` and `CFG.eval_arm` must be explicit config values set before run. The adapter arm choice must be written into every output file. `_find_adapter()` auto-discovery must be removed.

**Status: ✅ FIXED — `Implemented (logic mirrored, Python not executed)`**  
*(Fix applied 2026-11-06 — `_find_adapter()` and `_inspect_adapter()` removed from NB3 Cell 6; replaced with explicit assertions on `CFG.eval_arm` and `CFG.adapter_path`).*

---

## V5 — Zero Quiz 3 Leakage in Training Data

**Requirement (Round 3 §0 Rule 0.2):** No Quiz 3 question text, rubric phrasing, denomination constants (1000, 500, 100, 50, 20, 10, 5, 1 in currency context), or student code snippets may appear in training or validation files.

**Status: Designed (Firewall Enforced in Source Code)**

**Evidence:**
- `cpp-grader-code/src/mutations.py`: Purged all Quiz 3 constants `(1000, 500, 100, 50, 20, 10, 5)`.
- `cpp-grader-code/nb1_data.py`: `QUESTION_BANK` contains 20 introductory programming questions; none involve currency, change-making, or denominations.
- `quiz3_split_upload.json` and `quiz3_split.json`: Sanitized (roll numbers stripped, SHA-256 hashes only).
- Final verification: Automated contamination scan to run on Kaggle once `cpp-grader-data-v2/` is generated by NB1.

---

## V6 — Spot Check (20 Static Examples)

**Requirement (Round 3 §Phase 0):** Produce 20 readable examples showing the grader's intended behaviour across syntax-broken, alternative-approach, genuine-bug, and naming-variation cases.

**Status: ✅ Implemented — see [`SPOTCHECK.md`](file:///c:/Users/istaf/OneDrive/Documents/kaggle_bundle/SPOTCHECK.md)**

---

## V7 — Zero Unmeasured Claims in EXPERIMENTS.md and AUDIT.md

**Requirement (Round 3 §0 Rule 0.1):** Every metric cell not produced by actual Python execution must be `NOT_MEASURED`. Smoke runs must be labelled `SMOKE_ONLY`.

**Status: ✅ FIXED — `Implemented (logic mirrored, Python not executed)`**  
*(All 23 pending cells in `EXPERIMENTS.md` set to `NOT_MEASURED`; projected token length estimates in `AUDIT.md` A7 struck and replaced with `NOT_MEASURED`).*

---

## Summary Matrix

| Item | Requirement | Status | Next Action |
|------|------------|--------|-------------|
| **V1** | No clamping in NB3/parse.py | ✅ FIXED | Ready for Kaggle execution |
| **V2a** | SYSTEM_PROMPT exact CRE language | ✅ FIXED | Ready for NB1 run |
| **V2b** | Exec report purely informational | ✅ FIXED | Ready for NB1 run |
| **V2c** | Syntax-error immunity mutations | ✅ FIXED | Ready for NB1 run |
| **V2d** | Schema doesn't penalise logic for compile | ✅ Correct | Ready |
| **V2e** | NB1 labeller compile-agnostic | NOT_MEASURED | Execute NB1 on Kaggle CPU |
| **V3** | `enable_thinking=False` everywhere | ✅ FIXED | Ready |
| **V4** | Explicit adapter path, no auto-discovery | ✅ FIXED | Set `EVAL_ARM` on Kaggle |
| **V5** | Zero Quiz 3 leakage in v2 data | Designed | Run leakage scan after NB1 |
| **V6** | 20 spot-check examples | ✅ Implemented | Complete in `SPOTCHECK.md` |
| **V7** | No unmeasured claims | ✅ FIXED | Complete in `EXPERIMENTS.md` |
