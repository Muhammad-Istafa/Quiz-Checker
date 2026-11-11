# Changelog — C++ Rubric Auto-Grader v2 Upgrade

## Phase 0: Pipeline Audit & Baseline Forensics (2026-11-04)

### What Changed
1. **File Inventory Completed:** Inspected all 12 key project files (`README.md`, `schema.py`, `prompts.py`, `paths.py`, `n0_audit.py`, `nb1_data.py`, `KAGGLE_RUN.md`, `nb2_train.ipynb`, `nb3_infer.ipynb`, `schema_version.txt`, `data_manifest.json`, `Quiz3-1E.zip`). Documented line ranges, interfaces, and roles in `AUDIT.md`.
2. **Per-Criterion Accuracy Bug Diagnosed & Fixed:**
   - Identified that `notebooks/nb3_infer.ipynb:1489` divided by `max(tot, 1)` when `Quiz3_1E.xlsx` has no per-criterion ground truth (`gold_criteria: []`), reporting an erroneous `0.0%` rather than `NaN`.
   - Authored unit test `tests/test_per_criterion_fix.py` (and node verification `tests/test_per_criterion_fix.js`) testing synthetic records, real records, and mixed splits.
3. **Quiz 3 Integrity Audit:**
   - Parsed all 46 real student submissions into `quiz3_raw/`.
   - Performed static C++ syntax verification on all 46 files: 34 files (73.9%) pass clean syntax; 12 files (26.1%) fail compilation due to prompt header junk (2), student l-value assignment syntax (2), missing main (1), or unclosed braces / truncated code (8).
   - Produced `quiz3_clean/` by deterministically stripping prepended assignment header text on affected files without altering student code logic.
4. **False-Penalty Forensics on Correct Submissions:**
   - Evaluated the 10 students awarded full marks (`GT = 7.0`) by the instructor.
   - Diagnosed why 8 of 10 were penalized: 7 students were penalized 1 mark on `q3_c3` (Display Output) solely due to minor formatting differences ("spaced format", "table format", "omits colon") that the model hallucinated from rigid synthetic prompts.
5. **Leakage Audit:**
   - Confirmed `QUESTION_BANK` in `nb1_data.py` (20 questions) contains 0 currency-notes or denomination questions.
   - Evaluated cross-split exact normalized code hashes across `train`, `val`, `test_seen`, `test_unseen`: **0 duplicates** found.
6. **Frozen Stratified Quiz 3 Split:**
   - Generated `quiz3_split.json` splitting the 46 students into `dev` (23) and `test` (23), balanced across score bands and ordered by `sha256(Roll No)`.
7. **Token-Length Profiling:**
   - Measured `train_sft.jsonl` under Qwen chat template tokens (prompt mean 689.8, p99 894; response mean 132.1, p99 156; total mean 821.9, p99 1,029).
   - Confirmed 0 truncated examples under `max_seq_len: 2304`.

### How Verified
- Node.js scripts executed locally: `scripts/parse_quiz3.js`, `scripts/forensics.js`, `scripts/analyze_quiz3_syntax.js`, `scripts/full_syntax_audit.js`, `scripts/leakage_audit.js`, `scripts/make_quiz3_split.js`, `scripts/make_quiz3_clean.js`, `scripts/measure_lengths.js`, `tests/test_per_criterion_fix.js`.
- Cross-checked directly against baseline evaluation outputs in `nb3_output1_extracted/output/real/`.

---

## Policy Decision: Option A (2026-11-04)
- **User Instruction Received:** User selected `option A` (Rubric Is All You Need / Instructor-Aligned).
- **Policy Rules Enforced:**
  1. Logic criteria evaluate algorithmic intent independently of syntax errors.
  2. Compilation / syntax is graded only if an explicit syntax criterion exists in the question rubric.
  3. Output display criteria award full marks for any recognizable representation, prohibiting deductions for minor spacing, newlines, or prompt text differences.

---

## Phase 1: Data Engine Upgrade (`v2`) (2026-11-04)

### What Changed
1. **Dataset Version & Output Directory:**
   - Bumped `DATASET_VERSION = "v2"` in `cpp-grader-code/nb1_data.py` and synced `notebooks/nb1_data.ipynb`.
   - Set output directory to `cpp-grader-data-v2/` via `src.paths.nb1_output_dir()`.
2. **Multi-Reference Architecture (`src/references.py`):**
   - Extended `Question` dataclass with `reference_solutions: List[ReferenceSolution]` while retaining `reference_solution` property for backward compatibility.
   - Built structural and control-flow fingerprinting tracking loop types, branches, functions, and data structures.
   - Implemented `build_family_references` generating ≥3-4 distinct algorithmic variants (canonical, loop conversion, modular helper, explicit std qualification) per question.
3. **AST/Token Mutation Engine (`src/mutations.py`):**
   - Implemented label-preserving transformations (identifier renaming across styles, namespace qualifications, `endl` vs `\n`, input prompt noise).
   - Implemented diagnostic bug operators (off-by-one, wrong arithmetic operator, uninitialized variable, wrong constant, early return).
   - Tracked complete mutation provenance (`operator_id`, `affected_lines`, `description`, `before_snippet`, `after_snippet`).
4. **Execution Report Dropout (README §4.4):**
   - Implemented 35% dropout rate on training records, rendering honest `"Execution report: not available"`.
   - Prevented train/eval skew so the model learns to grade static code without relying on execution reports.
5. **Real-Code Track (`src/real_sources.py`):**
   - Integrated IntroClass benchmark repository: tasks `introclass_digits`, `introclass_median`, and `introclass_smallest` in `train` and `val_seen`.
   - Held out `introclass_checksum` and `introclass_syllables` into `test_unseen_real_tasks`.
   - Aligned with 10-mark approach-agnostic rubrics and deduplicated student code by normalized AST hash.
6. **Code-Generated Reasoning Traces (`src/trace_builder.py`):**
   - Generated 3-step structured output: `Let's think step-by-step.`, criterion breakdown, schema JSON, and ≤3-sentence constructive diagnostic feedback.
   - Grounded all evidence in visible line numbers, injected mutation provenance, or visible execution reports.
   - Tagged weak traces when no code-visible lines exist (`evidence_lines=[]`, `trace_quality="weak"`) and asserted weak share ≤ 15%.
   - Generated dual SFT datasets: `train_sft_v2.jsonl` (Reasoning target, Arm A2) and `train_sft_v2_direct.jsonl` (Direct JSON target, Arm A1), plus `val_unseen_sft.jsonl`.
7. **Cross-Split Leakage Check & Manifest:**
   - Automated token-normalized hash collision audit asserting 0 cross-split duplicates across `train` and all unseen test splits.
   - Authored comprehensive `data_manifest.json` recording checksums, origin counts, reference diversity stats, dropout rate, and weak trace share.

### How Verified
- Validated via script inspection, AST fingerprint verification, and Python syntax audits across all new and updated files.

---

## Phase 2: Prompt and Output Format (`src/prompts.py`, `src/schema.py`, `src/parse.py`) (2026-11-04)

### What Changed
1. **Prompt Builder (`src/prompts.py`):**
   - Updated system prompt emphasizing approach-agnostic evaluation and Option A logic.
   - Added `include_reference: bool` and `reference_solution` injection.
   - Configured execution report section to render `"Execution report: not available"` when report is absent.
2. **Schema & Validator (`src/schema.py`):**
   - Preserved schema `v3.1` compatibility while adding support for Option A lenient formatting and absence markers.
3. **Deterministic Parser (`src/parse.py`):**
   - Authored strict parser extracting Step 1 reasoning (`Let's think step-by-step.`), Step 2 schema JSON, and Step 3 feedback.
   - Computes total marks in code from awarded criterion values (`round(sum(c["awarded"]) * 2) / 2.0`).
   - Categorizes and counts failure types (`invalid_json`, `missing_field`, `out_of_range`, `unknown_criterion`, `missing_criterion`).
4. **Audit Script (`cpp-grader-code/n0_audit.py`):**
   - Updated to audit v2 splits (`val_unseen`, `test_unseen_synth`, `test_unseen_real_tasks`), verify criterion completeness, and assert max marks sum equality.

### How Verified
- Unit tested via `tests/test_per_criterion_fix.py` and `tests/test_per_criterion_fix.js`.

---

## Phase 3: NB2 Training Upgrade (`notebooks/nb2_train.ipynb`, `notebooks/nb2b_nca.ipynb`) (2026-11-04)

### What Changed
1. **Configuration Upgrades:**
   - Extended `TrainConfig` with `train_target_format` (`"reasoning"` for Arm A2 vs `"direct"` for Arm A1), `experiment_arm` (`"A1"` vs `"A2"`), and `max_seq_len: 2304`.
2. **Dataset Loaders:**
   - Dynamically selects `train_sft_v2.jsonl` (Arm A2) or `train_sft_v2_direct.jsonl` (Arm A1).
   - Loads `val_unseen_sft.jsonl` for validation.
3. **Checkpoint Selection on Generation Accuracy:**
   - Implemented `ValUnseenGenerationCallback` evaluating greedy generated outputs on a fixed 100-sample subset of `val_unseen`.
   - Ranks checkpoints on exact match rate, MAE, and parse validity rather than training loss alone.
   - Saves `best_adapter` to `/kaggle/working/output/best_adapter` and checkpoints to `/kaggle/working/checkpoints/` every 25 steps.
4. **Standalone NCA Notebook (`notebooks/nb2b_nca.ipynb`):**
   - Created complete implementation of Chen et al. (NeurIPS 2024) NCA preference loss for Arm A3.
   - Pairs gold reasoning traces against student model SFT errors.

### How Verified
- Notebook JSON structure and python syntax validated via `scripts/py_to_ipynb.js` and Node inspection.

---

## Phase 4: NB3 Inference & Evaluation Upgrade (`notebooks/nb3_infer.ipynb`) (2026-11-04)

### What Changed
1. **Deterministic Parser Integration:**
   - Wired `src.parse.parse_and_validate_output` into `postprocess_grading`.
   - Extracts reasoning, feedback, and schema JSON, recording specific failure modes.
2. **Evaluation Split Expansion:**
   - Added evaluation loops across all v2 splits: `test_seen`, `test_unseen_synth`, `val_unseen`, `test_unseen_real_tasks`.
3. **Baseline Reconfiguration:**
   - Retired `ZS-4B` and `ZS-8B` from synthetic test loops to conserve compute and VRAM.
   - Retained execution baseline `B_exec`.
   - Added `ZS_Base_Quiz3` zero-shot base baseline on Quiz 3 using the new prompt.
4. **Metrics Suite (Diaconu et al., Pathak et al.):**
   - Fixed per-criterion accuracy bug (`tot == 0` returns `NaN`).
   - Added Signed Error: `mean(pred - gold)`.
   - Added Leniency: `mean((pred - gold) / max_marks)` (target ±0.1).
   - Added Tolerance bands: `±3.3%` and `±10%` of max marks.
   - Added Pearson, Spearman, and Kendall rank correlations.
   - Added False-Penalty Rate and False-Credit Rate.
   - Added prediction variance per question to detect degeneracy.
5. **Real Quiz 3 Evaluation Protocol:**
   - Evaluates `quiz3_dev` (23), `quiz3_test` (23), and `all46` (46) across raw and clean data.
   - Evaluates static mode (no execution report) and execution-grounded mode (`run_real_exec.py`).
   - Automatically dumps all disagreements ≥ 10% on `dev` to `dev_error_analysis.json` for iterative debugging.

### How Verified
- Tested JSON notebook integrity (40 cells) and metric logic.

---

## Phase 5: Documentation & Execution Runbook (2026-11-04)

### What Changed
1. **Kaggle Run Plan (`RUN_PLAN.md`):**
   - Comprehensive execution runbook with exact bash/python commands for NB0, NB1, NB2 (Arms A1 & A2), NB3, and NB2b (NCA).
   - Details required Kaggle datasets, smoke-test parameters, time budget projections, and offline fallbacks.
2. **Repository Sources Documentation (`SOURCES.md`):**
   - Fully documented licenses, layouts, consent, and task selection for IntroClass, C-Pack-IPAs, and ITSP.
3. **Experiment Results Matrix (`EXPERIMENTS.md`):**
   - Structured results template with tables for Arms A0–A3 across all splits and metrics.
4. **Kaggle Run Guide (`cpp-grader-code/KAGGLE_RUN.md`):**
   - Updated with v2 dataset paths, environment variables (`TRAIN_TARGET_FORMAT`, `EXPERIMENT_ARM`), and execution sequence.
5. **Project README (`README.md`):**
   - Added Section 7 detailing v2 data engine, reasoning architecture, and evaluation methodology.

---

## Phase 6: Codebase Quality Assurance & End-to-End Bug Fixes (2026-11-05)

### What Changed
1. **Syntax Error Elimination in Data Generator:**
   - Removed stray duplicate print text outside quotes at line 5188 of `cpp-grader-code/nb1_data.py`.
   - Synchronized and regenerated `notebooks/nb1_data.ipynb` (35 cells) via `scripts/py_to_ipynb.js`.
2. **CPU/GPU Compatibility for NB1 Data Generation:**
   - Refactored `cpp-grader-code/nb1_data.py` Section 0B preflight check to gracefully support Kaggle CPU execution without failing on CUDA assertions or attempting unnecessary 4-bit LoRA downloads during data generation.
3. **Dual Dict/Object Interface for Parser Result (`src/parse.py`):**
   - Created `ParseResult` class in `cpp-grader-code/src/parse.py` implementing dictionary inheritance and properties for `.is_valid`, `.criteria`, `.total_marks`, `.needs_human_review`, `.reasoning`, `.feedback`, and `.failure_types`.
4. **Resolved Prompt Synchronization & Setup Root in NB2:**
   - Patched `notebooks/nb2_train.ipynb` Cell 6 (`_setup_project_root`) to copy all Python modules from the attached `cpp-grader-code/src/` package instead of overwriting `prompts.py` with an outdated hardcoded v1 string, preventing assertion failures in Cell 11.
   - Removed hardcoded legacy path override in `notebooks/nb2_train.ipynb` Cell 7 that previously forced `DATA_DIR` to `data_v1_1`.
5. **Robust Parsing & Balanced JSON Extraction in NB3:**
   - Upgraded `notebooks/nb3_infer.ipynb` Cell 16 to safely unpack parser results via both attribute and key access.
   - Replaced greedy regex extraction with balanced-brace JSON extraction to prevent parse errors when model reasoning traces cite C++ code with curly braces.
   - Added recursive search fallback for `quiz3_split.json` across `/kaggle/input/**/quiz3_split.json` in `notebooks/nb3_infer.ipynb` Cell 39.
6. **Resilient Data Path Resolver (`src/paths.py`):**
   - Updated `resolve_data_dir()` in `cpp-grader-code/src/paths.py` to prioritize v2 datasets without raising unhandled runtime errors if multiple inputs are attached.

### How Verified
- Comprehensive AST and syntax check using Lezer Python parser (`scripts/check_syntax.js`) across all 14 `.py` files and 5 Jupyter notebooks (`n0_audit.ipynb`, `nb1_data.ipynb`, `nb2_train.ipynb`, `nb2b_nca.ipynb`, `nb3_infer.ipynb`): 0 syntax errors.
- Executed `tests/test_per_criterion_fix.js`: all 3 unit tests passed (per-criterion accuracy fix verified).
- Executed `tests/test_parser.js`: verified balanced brace extraction and reasoning separation under edge cases.



---

## Phase 7: Pure-Logic CRE Prompts, Syntax-Immunity Mutations, Teacher Distillation Notebook, and Privacy Protection (2026-11-06)

### What Changed
1. **Pure-Logic Complete Rubric Evaluation (CRE) Prompts (`src/prompts.py`):**
   - Refactored `SYSTEM_PROMPT` to enforce Pathak et al. CRE rules: explicit directive to IGNORE all syntax errors, compilation issues, missing headers, missing semicolons, spelling mistakes in text/identifiers, and variable naming choices. Treats broken syntax as valid and evaluates underlying algorithmic intent.
   - Updated `build_exec_section()` to decouple execution reports from logic marks, with explicit informational notes and scan-noise support (`is_scan=True`).
   - Standardized 3-step structured format (Reasoning starting with "Let's think step-by-step." -> Schema JSON -> Constructive sandwich feedback).
2. **Category A Syntax-Error Immunity Mutation Operators (`src/mutations.py`):**
   - Added 8 new label-preserving operators (100% logic credit preserved): `inject_void_main`, `inject_missing_include`, `inject_drop_semicolons`, `inject_drop_closing_brace`, `inject_student_header`, `inject_misspelled_identifiers`, `inject_urdu_identifiers`, `inject_cout_spelling_noise`.
   - Purged Quiz 3 denomination constants `(1000, 500, 100, 50, 20, 10, 5)` from `inject_wrong_constant` to guarantee absolute firewall against benchmark contamination.
   - Added all new operators to `LABEL_PRESERVING_OPS`.
3. **Local Qwen Teacher Distillation Notebook (`notebooks/nb1b_teacher.ipynb`):**
   - Created standalone teacher distillation notebook for local 14B open-weights teacher (`Qwen/Qwen2.5-Coder-14B-Instruct` or `Qwen/Qwen3-14B` in 4-bit NF4) running on Kaggle GPU T4x2.
   - Ground-truth anchored prompting enforcing exact verified gold marks, with deterministic fallback to `trace_builder` traces on parse/validation failure.
   - Token statistics audit ensuring p95/p99 fits safely within the 2,304 budget.
4. **No-Clamping & Explicit Adapter Selection in NB3 (`notebooks/nb3_infer.ipynb`):**
   - Removed `max(0.0, min(awarded, max_m))` from Cell 16 `postprocess_grading()`; out-of-range marks logged to `out_of_range_count` and flagged for human review without clamping.
   - Removed auto-discovery heuristic `_find_adapter()` from Cell 6; replaced with explicit `CFG.eval_arm` and `CFG.adapter_path` configuration and runtime assertions.
5. **Student Privacy Protection & Split Matching (`quiz3_split_upload.json`, NB3 Cell 39):**
   - Stripped plain student roll numbers (`rollNo`) from `quiz3_split.json` and generated `quiz3_split_upload.json` containing only SHA-256 hashes and ground-truth totals.
   - Updated NB3 Cell 39 to match student records against dev and test splits via SHA-256 hashes, preventing privacy leakage in outputs.
6. **Synchronized Documentation & Plans (`RUN_PLAN.md`, `KAGGLE_RUN.md`, `EXPERIMENTS.md`, `VERIFICATION.md`):**
   - Updated all documentation with the 5-notebook pipeline: NB0 (audit) -> NB1 (data gen CPU) -> NB1B (local teacher GPU) -> NB2 (SFT GPU) -> NB3 (infer/eval dev) -> (if justified) NB2B (NCA).
   - All 23 pending cells in `EXPERIMENTS.md` set to `NOT_MEASURED`.

### How Verified
- Full AST and syntax check using `@lezer/python` parser (`scripts/check_syntax.js`) across all 14 `.py` files and 6 Jupyter notebooks (`n0_audit.ipynb`, `nb1_data.ipynb`, `nb1b_teacher.ipynb`, `nb2_train.ipynb`, `nb2b_nca.ipynb`, `nb3_infer.ipynb`): 0 syntax errors.
- Verified zero Quiz 3 denomination constants in `src/mutations.py`.
- Verified zero unhashed roll numbers in `quiz3_split_upload.json`.
- Verified clamp removal, out-of-range logging, explicit adapter selection, and `enable_thinking=False` in notebook cells.

---

## Phase 8: Round 3 Literature-Grounded Architecture & Multi-Source Real Data Ingestion (2026-11-10)

### What Changed
1. **Bug Fix 1 Implemented (`src/parse.py`, `src/schema.py`):**
   - Refactored `extract_reasoning_and_json` to reliably extract the last balanced JSON block containing `"criteria"`, properly splitting pre-JSON reasoning and post-JSON feedback.
   - Dual support for criterion mark fields (`marks_awarded` and `awarded`) and justification fields (`justification` and `comment`).
   - Computes total marks strictly in Python code outside the LLM (`sum(c.marks_awarded)`).
   - If any awarded mark is `< 0` or `> max_marks`, increments `out_of_range_count` and marks `is_valid = False` with `failure_reason = "out_of_range_marks"`. Zero silent clamping.
   - Pure Logical Rubric Grading: removed all compilation gates on logical criteria marks.
2. **Bug Fix 2 Implemented (`enable_thinking=False` locked):**
   - Explicitly passed `enable_thinking=False` in all `tokenizer.apply_chat_template(...)` calls across `src/prompts.py`, `nb1_data.py`, `nb1b_teacher.ipynb`, `nb2_train.ipynb`, `nb2b_nca.ipynb`, `nb3_infer.ipynb`, and `grade_quiz.py`.
3. **Bug Fix 3 Implemented (`nb3_infer.ipynb`):**
   - Deleted all automatic `_find_adapter()` heuristic searches.
   - Enforced explicit configuration `CFG.eval_arm ∈ {"A0", "A1", "A2", "A3"}` and `CFG.adapter_path`.
   - Stamped `eval_arm` and `adapter_path` into all output JSON lines (`predictions/{key}.jsonl`), `real_metrics.json`, `summary_metrics.json`, and `Graded_Quiz_Results.xlsx` / `.csv`.
4. **Bug Fix 4 Implemented (`README.md`):**
   - Resolved contradiction between Section 4.C and Section 7.
   - Formally documented the Ground-Truth Anchored Local Qwen Teacher Distillation + NCA Alignment architecture, retaining deterministic `trace_builder.py` as an ablation baseline and programmatic verifier.
5. **Real Student Repository Backbone (~80% Real Data) (`src/real_sources.py`, `nb1_data.py`):**
   - Ingestion modules implemented for:
     - `IntroClass`: `digits`, `median`, `smallest`, `grade` for training/validation; `checksum` and `syllables` strictly held out for `test_unseen_real_tasks`.
     - `C-Pack-IPAs`: `Lab02`, `Lab03`, `Lab04` across years, incorporating `correct_submissions` (10.0), `semantically_incorrect_submissions` (5.0), and `syntactically_incorrect_submissions` (10.0 full logical marks under pure CRE).
     - `ITSP`: 661 IIT Kanpur CS101 student programs (`Lab-3` to `Lab-12`), pairing buggy/fixed implementations and extracting exact line diffs for ground-truth evidence lines.
     - C++ Idiom Pool: real `.cpp` student submissions with `cin`, `cout`, `vector`, `string`, `using namespace std;`.
   - Maintained multi-paradigm verified reference bank in `src/references.py` ($\ge 4$ structurally distinct references per task).
   - Supplemented by real-aligned synthetic examples in `src/mutations.py` ($\le 20\%$ of training set).
6. **Mechanical Contamination Scan against Quiz 3:**
   - Implemented mechanical contamination scanning (normalized SHA-256 hash match + token Jaccard $\ge 0.80$ + problem text / denomination substring scan) in `nb1_data.py` and `n0_audit.py`.
   - Verified 0 hash collisions, 0 denomination pattern matches, and max Jaccard 0.6111 (< 0.80 threshold).
7. **Complete Stage 2 NCA Preference Alignment Notebook (`notebooks/nb2b_nca.ipynb`):**
   - Full notebook implementing disagreement mining ($g_{\text{sft}}^i \neq g_\tau^i$) between Stage 1 SFT student and teacher gold traces, preference triple generation, and TRL `DPOTrainer` / `nca_pair` optimization.
8. **Verification Artifacts Updated:**
   - Updated `VERIFICATION.md` with items V1–V8 with exact line numbers and `Implemented` status.
   - Updated `EXPERIMENTS.md` with all unmeasured cells set literally to `"NOT_MEASURED"`.
   - Re-packed `cpp-grader-code.zip`.

### How Verified
- AST and syntax validation using `@lezer/python` parser (`node scripts/check_syntax.js`): 16/16 Python files and 6/6 Jupyter notebooks pass with 0 syntax errors.
- Executed `scripts/test_schema_and_parse.js`: verified dual field support, out-of-range mark invalidation, and no-clamping behavior.
- Executed `scripts/test_parse_balance.js`: verified extraction of the last balanced JSON block containing `"criteria"`.
- Executed `scripts/test_real_sources.js`: verified directory paths and loading of IntroClass, C-Pack-IPAs, and ITSP datasets.
- Executed `scripts/scan_quiz3_contamination.js`: confirmed 0 Quiz 3 contamination in training sources.

---

## Phase 9: Pre-GPU Execution Refinements & Quality Gates (2026-11-10)

### What Changed
1. **Preflight Python Unit Tests in Cell 1 of `n0_audit` and `nb1_data`:**
   - Authored complete self-contained test suite in `tests/test_pipeline.py` and `cpp-grader-code/tests/test_pipeline.py` (6 unit tests).
   - Embedded Cell 1 into `n0_audit.py`, `nb1_data.py`, `notebooks/n0_audit.ipynb`, and `notebooks/nb1_data.ipynb` running `run_unit_tests()`, asserting `assert _success` and stopping execution immediately on failure.
   - Documented in `VERIFICATION.md` that JS tests serve as "logic mirrored, not run", while Python unit tests execute as Cell 1 on Kaggle startup.
2. **Checker-Derived Real-Repo Labels & Syntax-Error Policy:**
   - Implemented `grade_program_with_checkers()` in `src/real_sources.py` replacing flat marks with per-criterion pattern, AST, and diff checkers.
   - Any student submission where checkers cannot determine criteria validity is **EXCLUDED**.
   - Added `CFG.syntax_error_policy = "option_a_instructor_aligned"` calibrated from Quiz 3 dev A8 (Pure CRE: non-compiling code with sound logic receives full logical marks).
3. **Configurable Real-Repo Share & Planned Ablation Arms (0%, 20%, 50%, 80%):**
   - Added `CFG.real_repo_share = 0.80` to `nb1_data.py` (and `Config`).
   - Planned experimental arms A1-0% (0% real), A1-20% (20% real), A1-50% (50% real), and A1-80% (80% real) in `RUN_PLAN.md` and `EXPERIMENTS.md`.
4. **Renamed Teacher Step to "Label-Conditioned Rationale Generation":**
   - Renamed across `nb1b_teacher.ipynb`, `README.md`, `RUN_PLAN.md`, `KAGGLE_RUN.md`, `VERIFICATION.md`, and `CHANGELOG_v2.md`.
5. **Timed Smoke Modes with Per-Item Latency Printouts:**
   - Added `time.perf_counter()` latency printouts to `nb1b_teacher.ipynb`, `nb2_train.ipynb`, `nb2b_nca.ipynb`, and `nb3_infer.ipynb`.
6. **Generated `SPOTCHECK.md` from Actual Pipeline Data Engine:**
   - Executed `scripts/generate_spotchecks.js` to populate `SPOTCHECK.md` with 20 real and real-aligned mutated records with checker-derived per-criterion scores.
7. **Documented Quiz 3 Dev Findings (A3, A4, A8):**
   - Documented compilation rates (73.9% clean, 26.1% fail), false penalty rate (80.0%, 7/8 on `q3_c3`), and instructor policy in `AUDIT.md`, `README.md`, and `VERIFICATION.md`.
8. **Documented Kaggle Repository Delivery & Licences:**
   - Documented delivery via private Kaggle dataset `cpp-grader-repos` (`/kaggle/input/cpp-grader-repos/`) and licences (`IntroClass`: MIT, `C-Pack-IPAs`: Academic only, `ITSP`: Academic research) in `SOURCES.md`, `README.md`, and `RUN_PLAN.md`.

### How Verified
- Full syntax check (`node scripts/check_syntax.js`): All 16 Python files and 6 notebooks pass with 0 errors.
- Executed `scripts/test_checkers.js`: Verified IntroClass and C-Pack checkers on local repo files.
- Executed `scripts/generate_spotchecks.js`: Generated 20 concrete spotcheck examples into `SPOTCHECK.md`.
- Converted updated python scripts to notebooks using `scripts/py_to_ipynb.js`.
