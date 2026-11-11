# C++ Assignment Auto-Grader — Project Overview & Benchmark Results

**Author:** Muhammad Istafa  
**Institution:** FAST NUCES  
**Goal:** Automated, rubric-grounded grading and diagnostic feedback for undergraduate C++ programming assignments using fine-tuned open-source language models.

---

## 1. Executive Summary

This project develops an automated grading pipeline for C++ student submissions against multi-criteria rubrics. Rather than treating grading as free-form text generation, the system frames grading as a structured, auditable decision process: the model evaluates student code against defined rubric criteria, assigns fractional/integer marks, justifies each mark with specific evidence lines, and outputs machine-validated JSON with an uncertainty flag (`needs_human_review`).

### Pipeline Architecture

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   NB0 (Audit)   │ ───>  │   NB1 (Data)    │ ───>  │   NB2 (Train)   │ ───>  │   NB3 (Eval)    │
│  Sanity & Schema│       │  Synthetic Gen  │       │  QLoRA 4-bit    │       │ Synthetic & Real│
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **`n0_audit.ipynb` (`n0_audit.py`)**: Validates rubric consistency, schema conformity (`v3.1`), and execution environment prerequisites before dataset construction.
2. **`nb1_data.ipynb` (`nb1_data.py`)**: Enumerates program variations across question families, runs sandboxed test executions to cache compilation and test outcomes, injects surface/OCR noise, and produces versioned SFT datasets (`train.jsonl`, `val.jsonl`, `test_seen.jsonl`, `test_unseen.jsonl`).
3. **`nb2_train.ipynb`**: Fine-tunes `Qwen/Qwen3-4B` via 4-bit QLoRA (NF4) with prompt-loss masking on Kaggle GPU accelerators (Tesla T4).
4. **`nb3_infer.ipynb`**: Performs batch inference with JSON schema validation, retry heuristics, bootstrap confidence interval estimation, and evaluation across synthetic test splits and real student submissions.

---

## 2. Actual Evaluation Results

All metrics below are drawn directly from the executed run outputs (`output/evaluation_summary.md` and `output/real/real_metrics.json`, Schema `v3.1`, Seed `42`).

### A. Synthetic Splits Benchmark (Full 1-Epoch Adapter)

Metrics include 95% bootstrap confidence intervals over student programs. The `@zs100` rows represent paired comparisons of the fine-tuned model on the exact sample subset graded by the zero-shot baselines.

| System | n | RAW JSON Validity | FINAL Exact Match (95% CI) | FINAL MAE (95% CI) | QWK (Kappa) | Criterion Accuracy (95% CI) | False Penalty on Correct Code | Review Flag % |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **FT-4B (test_seen)** | 284 | 100.0% | **97.54%** [0.951, 0.993] | **0.026** [0.007, 0.052] | **0.982** | **99.45%** [0.989, 0.998] | 2.70% (n=37) | 3.87% |
| **FT-4B (test_seen@zs100)** | 93 | 100.0% | **97.85%** [0.944, 1.000] | **0.016** [0.000, 0.045] | **0.994** | **99.50%** [0.987, 1.000] | 0.00% (n=14) | 6.45% |
| **FT-4B (test_unseen)** | 280 | 100.0% | **73.93%** [0.686, 0.793] | **0.429** [0.329, 0.541] | **0.896** | **92.54%** [0.909, 0.941] | 13.33% (n=30) | 8.57% |
| **FT-4B (test_unseen@zs100)**| 94 | 100.0% | **78.72%** [0.691, 0.862] | **0.346** [0.191, 0.532] | **0.924** | **93.50%** [0.908, 0.959] | 0.00% (n=13) | 11.70% |
| **FT-4B (val)** | 275 | 100.0% | **98.55%** [0.970, 0.996] | **0.011** [0.002, 0.024] | **0.995** | **99.68%** [0.993, 0.999] | 6.25% (n=32) | 5.82% |
| **FT-4B (val@zs100)** | 92 | 100.0% | **100.0%** [1.000, 1.000] | **0.000** [0.000, 0.000] | **1.000** | **100.0%** [1.000, 1.000] | 0.00% (n=8) | 5.43% |
| **ZS-4B (test_seen)** | 93 | 55.0% | 31.18% [0.216, 0.419] | 1.172 [0.948, 1.392] | 0.150 | 64.18% [0.568, 0.716] | 28.57% (n=14) | 18.28% |
| **ZS-4B (test_unseen)** | 94 | 86.0% | 44.68% [0.351, 0.553] | 1.000 [0.745, 1.298] | 0.706 | 78.92% [0.740, 0.833] | 30.77% (n=13) | 2.13% |
| **ZS-4B (val)** | 92 | 52.0% | 32.61% [0.230, 0.436] | 1.114 [0.866, 1.383] | 0.227 | 63.83% [0.553, 0.717] | 37.50% (n=8) | 19.57% |
| **ZS-8B (test_seen)** | 93 | 76.0% | 24.73% [0.161, 0.351] | 1.285 [1.010, 1.544] | 0.199 | 58.71% [0.504, 0.671] | 28.57% (n=14) | 23.66% |
| **ZS-8B (test_unseen)** | 94 | 96.0% | 25.53% [0.170, 0.351] | 1.479 [1.106, 1.894] | 0.412 | 66.82% [0.615, 0.722] | 38.46% (n=13) | 4.26% |
| **ZS-8B (val)** | 92 | 82.0% | 21.74% [0.128, 0.322] | 1.120 [0.871, 1.380] | 0.281 | 63.83% [0.563, 0.708] | 37.50% (n=8) | 17.39% |

---

### B. Real Student Evaluation (FAST NUCES Quiz 3)

The pipeline was evaluated on **46 real undergraduate student submissions** for Quiz 3 (Currency Note Calculation in C++, 4 rubric criteria, Max Marks = 7.0):

| System | Exact Match % (95% CI) | Within 0.5 Marks | MAE (95% CI) | QWK (Kappa) | Correct False-Penalty Rate | Review Flag % |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **FT-4B_real** | **23.91%** [0.130, 0.370] | **28.26%** | **2.076** [1.533, 2.631] | **0.375** | **80.0%** (8 of 10 penalized) | 15.2% |
| **ZS-4B_real** | 13.04% [0.043, 0.239] | 21.74% | 2.696 [2.065, 3.359] | 0.150 | 80.0% (8 of 10 penalized) | 37.0% |
| **ZS-8B_real** | 2.17% [0.000, 0.065] | 10.87% | 2.565 [2.098, 3.098] | 0.273 | 100.0% (10 of 10 penalized) | 8.7% |

---

## 3. Real-World Failure Analysis & Generalization Gap

Comparing synthetic unseen performance (**QWK 0.896, Exact Match 73.93%**) against real student performance (**QWK 0.375, Exact Match 23.91%**) reveals three core factors:

```
Synthetic Data Paradigm (Current NB1):
[Single Reference AST] ──(find/replace string mutation)──> Syntactic Clones ──> Model Overfits AST

Real Classroom Reality (Quiz 3):
[Student Submissions]  ──(diverse algorithms: arrays, loops, if-else, cin styles)──> Model Flags Unfamiliar Syntax as Errors
```

1. **Single-Template Mutation Bias**:
   - In `nb1_data.py`, each synthetic question is generated by applying string replacements (`find`/`replace`) to a single canonical `reference_solution`.
   - Real students implemented diverse problem-solving strategies (e.g., array lookups `int notes[] = {1000, 500, ...}` vs. repeated divisions vs. while loops).
   - Because the fine-tuned model only encountered variations of one reference template during training, **it treated alternative algorithmic strategies as errors**, resulting in an **80.0% false penalty rate** on correct submissions.
2. **Train/Inference Feature Skew (Execution Reports)**:
   - In synthetic splits, every record included an `execution_report` containing automated compilation and test output.
   - On the real Quiz 3 submissions, test harnesses were unavailable (`execution_report = {"available": False}`).
   - The model had learned to rely on test status flags; removing them degraded grading accuracy.
3. **Absence of Chain-of-Thought (Direct JSON Emission)**:
   - The model was forced to output numerical marks in JSON directly without an intermediate scratchpad to reason over student control flow.

---

## 4. Architectural Roadmap & Upgrades

### A. Grounding Synthetic Data with Real Introductory Datasets

To ensure the model learns diverse programming idioms and real-world defect patterns, the synthetic generator will ingest and align with established benchmarks:

- **ITSP (`jyi/ITSP`)**: 661 real undergraduate C programs from IIT Kanpur CS-101 across 10 lab problem families, containing buggy/fixed student pairs and test suites.
- **C-Pack-IPAs (`pmorvalho/C-Pack-IPAs`)**: 25 introductory C assignments from IST Lisbon with pre-classified semantically correct, semantically incorrect, and syntactically incorrect submissions.
- **Codeflaws (`codeflaws/codeflaws`)**: 3,902 real human defects from Codeforces in C, including boundary, type, and algorithmic errors with unit tests.
- **IBM Project CodeNet (`IBM/Project_CodeNet`)**: Millions of introductory C/C++ submissions with diverse control structures and acceptance statuses.

### B. Upgrades to Synthetic Data Generation (`nb1_data.py`)

1. **Multi-Template Seeds**: Provide 3–5 structurally distinct reference solutions per question (e.g., recursive, array-based, loop-based, chained conditional) before applying mutations.
2. **Execution Report Dropout**: Randomly set `execution_report = {"available": False}` for 35% of synthetic training samples to make the model robust to offline static grading.
3. **AST-Level Defect Ingestion**: Replace literal string replacements with AST-level pattern insertions matching real student errors (e.g., integer truncation, uninitialized variables, inverted conditions).

### C. Label-Conditioned Rationale Generation & NCA Preference Alignment (SIGCSE 2026)

- **Retire `ZS-4B` and `ZS-8B` from NB3**:
  - `ZS-8B` collapsed on real student data (2.17% exact match) and caused GPU memory overhead on Kaggle T4 instances.
  - Retain `ZS-CRE-4B` as a lightweight direct zero-shot Complete Rubric Evaluation baseline.
- **Implement Label-Conditioned Rationale Generation**:
  - Following the framework in *Koutcheme, Woodrow, & Piech (SIGCSE 2026)*:
    1. **Structured Rubric Prompt**: The model is prompted with a 3-step structured format:
       - `Step 1 (Reasoning)`: Chain-of-thought analysis reflecting on each rubric criterion in order (`"Let's think step-by-step."`).
       - `Step 2 (Rubric Grading)`: Structured JSON mark assignment with external Python total summation (zero clamping).
       - `Step 3 (Diagnostic Feedback)`: Actionable feedback explaining errors and strengths.
    2. **Ground-Truth Anchoring**: A large local open-weights teacher model (`Qwen2.5-Coder-14B-Instruct` or `Qwen3-14B` in 4-bit NF4) receives verified ground-truth criterion marks and generates high-capacity reasoning traces conditioned on the gold labels.
    3. **Deterministic Fallback**: `src/trace_builder.py` is retained as an offline deterministic trace generator and ablation verifier.
    4. **Preference Alignment (NCA / DPO)**: Pairs are mined from student-gold disagreements, optimized via Noise Contrastive Alignment (NCA) loss in `nb2b_nca.ipynb` to eliminate false penalties without degradation.

### D. Real Student Repository Share & Experimental Arms

To systematically evaluate the impact of real classroom code versus synthetic mutations, the pipeline supports a configurable real-repo share (`CFG.real_repo_share` in `nb1_data.py`):
- **Arm A1-0%**: 0% real student code, 100% synthetic mutations.
- **Arm A1-20%**: 20% real student code, 80% synthetic mutations.
- **Arm A1-50%**: 50% real student code, 50% synthetic mutations.
- **Arm A1-80%**: 80% real student code, 20% synthetic mutations (Default training backbone).
- **Arm A2**: Supervised Fine-Tuning with label-conditioned reasoning traces (14B Teacher / Trace Builder).
- **Arm A3**: Noise Contrastive Alignment (NCA) preference alignment over Arm A2.

### E. Verification & Quality Gates

1. **Preflight Python Unit Tests**: Executed as the first cell of `n0_audit.ipynb` and `nb1_data.ipynb`, halting execution immediately with `AssertionError` if any test fails. Covers balanced JSON parsing, zero clamping, dual-field support, pure-logic evaluation, and external Python summation. Local JavaScript test suites count as "logic mirrored, not run".
2. **Kaggle Repository Delivery & Licensing**: Real student repositories are delivered to Kaggle via a private dataset `cpp-grader-repos` (mounted at `/kaggle/input/cpp-grader-repos/` with fallback to `repos/`). Licences: `IntroClass` (MIT License, permissive open-source), `C-Pack-IPAs` (academic and research use only, INESC-ID / IST Lisbon), and `ITSP` (academic research license, IIT Kanpur CS101). The FAST NUCES Quiz 3 benchmark is strictly firewalled in a separate dataset (`cpp-grader-quiz3-eval`) and never co-packaged with training data.
3. **Calibrated Syntax Policy from Quiz 3 Dev**: In accordance with Quiz 3 dev audit findings (A3: 26.1% syntax error rate, A8: instructor awards full marks to non-compiling code with sound logic), the pipeline default is `syntax_error_policy = "option_a_instructor_aligned"` (Pure CRE: zero compilation penalty on logical rubric criteria).

---

## 5. Repository Structure

```
kaggle_bundle/
├── cpp-grader-code/              # Reusable core modules & scripts
│   ├── src/
│   │   ├── __init__.py
│   │   ├── schema.py             # Schema v3.1 definition, validators & normalizers
│   │   ├── prompts.py            # System prompts & message builders
│   │   └── paths.py              # Dynamic Kaggle/local path resolvers
│   ├── config/
│   │   └── schema_version.txt    # "v3.1"
│   ├── n0_audit.py               # Preflight audit script
│   ├── nb1_data.py               # Data generation script
│   ├── dataset-metadata.json     # Kaggle code package metadata
│   └── KAGGLE_RUN.md             # Execution instructions
├── cpp-grader-data-v1-1/         # Generated synthetic dataset (v1.1 / schema v3.1)
│   ├── train.jsonl               # Training set (seen families)
│   ├── train_sft.jsonl           # Chat-formatted SFT training set
│   ├── val.jsonl                 # Validation set
│   ├── val_sft.jsonl             # Chat-formatted SFT validation set
│   ├── test_seen.jsonl           # Test set on seen question families
│   ├── test_unseen.jsonl         # Test set on unseen question families
│   ├── execution_reports.json    # Cached compile/test results
│   ├── exec_cache.json           # Content-addressed execution cache
│   └── data_manifest.json        # Checksums, split counts & schema locks
├── notebooks/                    # Jupyter notebooks for Kaggle runs
│   ├── n0_audit.ipynb            # Interactive dataset & environment audit
│   ├── nb1_data.ipynb            # Real student repo + synthetic data generation
│   ├── nb1b_teacher.ipynb        # Local Qwen 14B Teacher Distillation (4-bit NF4)
│   ├── nb2_train.ipynb           # QLoRA fine-tuning on Qwen3-4B (Arm A1/A2)
│   ├── nb2b_nca.ipynb            # Noise Contrastive Alignment (Arm A3 NCA)
│   └── nb3_infer.ipynb           # Multi-arm evaluation, bootstrap CIs & real holdout evaluation
├── Quiz3-1E.zip                  # Real student evaluation bundle (FAST NUCES)
│   ├── Quiz3_1E.xlsx             # Real student code & ground-truth teacher marks
│   ├── question.txt              # Currency note calculation problem statement
│   └── rubric.txt                # 4-criterion grading rubric (7.0 marks total)
├── nb2_full output.zip           # Saved LoRA adapter weights & training state
├── nb3 output1.zip               # Saved inference predictions, logs & evaluation summaries
└── README.md                     # This file
```

---

## 6. How to Reproduce

1. **Verify Environment**: Run `notebooks/n0_audit.ipynb` to verify dependencies (`bitsandbytes >= 0.46.1`, `peft`, `accelerate`, CUDA availability).
2. **Train Model**: Run `notebooks/nb2_train.ipynb` with GPU T4 x2 enabled on Kaggle. The script loads `cpp-grader-data-v1-1` and outputs `best_adapter/`.
3. **Evaluate**: Run `notebooks/nb3_infer.ipynb` attaching the generated adapter and `Quiz3-1E`. The notebook produces full evaluation summaries (`evaluation_summary.md`, `real_summary.md`, and `real_metrics.json`).

---

## 7. Version 2 Architecture Upgrade (v2 Benchmark)

The v2 upgrade directly resolves the generalization gap between synthetic test data and real classroom student submissions:

### Key Enhancements
1. **Multi-Template Structural Seeds (`src/references.py`)**:
   - Each question bank entry is seeded with multiple structurally verified reference solutions (iterative, array-based, while-subtraction, helper function, etc.).
   - Structural distinctness is verified via control-flow and AST signature hashing.
2. **AST-Level & Token Mutation Engine (`src/mutations.py`)**:
   - Replaced fragile string search-and-replace with token-level mutation operators.
   - Distinct classes: **Label-preserving transforms** (identifier renaming across styles, `using namespace std;` vs `std::`, `endl` vs `\n`, interactive prompt noise) that target false penalties on valid student code, and **diagnostic bug operators** (boundary off-by-one, wrong operators, uninitialized accumulators, wrong constants).
   - Every mutation records full provenance (operator ID, affected line numbers, plain-text descriptions) to ground reasoning traces.
3. **Execution Report Dropout (35%)**:
   - Training prompts randomly drop the execution block on 35% of examples, providing the exact text seen during offline grading: `Execution report: not available`.
4. **Two-Stage Distillation & Alignment Pipeline (`nb1b_teacher.ipynb`, `nb2b_nca.ipynb`, & `src/trace_builder.py`)**:
   - Three-step structured output format following *Koutcheme, Woodrow, & Piech (SIGCSE 2026)* and *Pathak et al. (CRE, 2025)*:
     - `Step 1`: Chain-of-thought analysis starting with `Let's think step-by-step.`, evaluating each rubric criterion in order, citing student line numbers, pardoning syntax/naming quirks, and stating the verdict.
     - `Step 2`: Compact validated schema JSON (`criteria` breakdown, `evidence_lines`, `needs_human_review`).
     - `Step 3`: Constructive sandwich feedback (≤3 sentences) praising satisfied criteria first, explaining at most two logical errors, and concluding with encouragement.
   - **Ground-Truth Anchored Local Qwen Teacher Distillation (`nb1b_teacher.ipynb`)**: A high-capacity local teacher model (`Qwen2.5-Coder-14B-Instruct` or `Qwen3-14B` in 4-bit NF4 on Kaggle 2×T4) is supplied with the verified gold criterion marks $g_{\text{true}}^i$ and diff/mutation provenance notes to produce rich, classroom-grounded reasoning traces $C_O = y_{\text{win}}^i$ passing strict automated verification gates (valid schema JSON, exact mark equality, valid evidence line bounds, and zero syntax-penalty phrases).
   - **Deterministic Fallback & Ablation Verifier (`src/trace_builder.py`)**: Programmatic trace generator creating formulaic reasoning traces directly from code checkers, retained as a deterministic fallback and ablation verifier (Arm A1 direct JSON vs. Arm A2 reasoning traces).
   - **Stage 2 NCA Preference Alignment (`nb2b_nca.ipynb`)**: Aligns the Stage 1 SFT student model using Noise Contrastive Alignment (NCA loss, Chen et al. NeurIPS 2024; $\beta=0.1$, $\text{lr}=5\times 10^{-6}$) on $(x, y_{\text{win}}=C_O, y_{\text{lose}}=C_{\text{sft}})$ disagreement triples to suppress false penalties on non-compiling student code and alternative algorithmic designs.
5. **Real Student Repository Backbone (~80% of Training Set) (`src/real_sources.py` & `SOURCES.md`)**:
   - Ingests real undergraduate student C/C++ programs from:
     - `C-Pack-IPAs` (Lab02–Lab04: conditionals, loops, digit manipulation, arrays), including correct, semantically incorrect, and syntactically incorrect programs (which receive full logical marks for valid intent under pure CRE).
     - `ITSP` (IIT Kanpur CS101: 661 programs across Lab-3 to Lab-12), extracting buggy/fixed program pairs and deriving exact `evidence_lines` and defect descriptions via AST/line diffs.
     - `IntroClass` (`digits`, `median`, `smallest`, `grade` for training/validation, holding out `checksum` and `syllables` strictly for `test_unseen_real_tasks`).
     - Real C++ Idiom Pool (`cin`, `cout`, `std::vector`, `std::string`, `using namespace std;`).
   - Supplemented by real-aligned synthetic examples (`src/mutations.py`, capped at $\le 20\%$ of training set) featuring syntax-breakage, naming, spelling, and control-flow immunity transforms.
6. **Frozen Stratified Quiz 3 Split (`quiz3_split.json`) & Mechanical Firewall**:
   - Stratified the 46 undergraduate student submissions into `dev` (23) and `test` (23) by instructor mark and hashed student ID. The `test` split is strictly held out for final reporting.
   - Mechanical contamination scan (normalized-code SHA-256 hash + token Jaccard $\ge 0.80$ + substring scan) enforced before training to guarantee zero Quiz 3 leakage.
7. **Pure Logical Rubric Evaluation (Pathak et al. CRE, 2025)**:
   - Logic criteria evaluate algorithmic intent independently of syntax errors. Zero compilation gate exists for logical rubric marks; missing `#include`, missing semicolons, `void main()`, undeclared types, Urdu transliterated identifiers (`rakam, baki`), and output string typos receive 100% full credit if algorithmic logic is satisfied. Totals are computed strictly in Python code outside the LLM.
8. **Experimental Arm Matrix (`EXPERIMENTS.md` & `RUN_PLAN.md`)**:
   - Structured tracking across Arms A0 (legacy baseline adapter), A1 (v2 data + direct JSON), A2 (v2 data + Stage 1 SFT on teacher-distilled 3-step output), and A3 (Stage 2 NCA preference alignment via `nb2b_nca.ipynb`), plus Zero-Shot CRE Baseline (`ZS-CRE-4B`).

