# Benchmark Experiment Matrix & Tracking Template (`EXPERIMENTS.md`)

This template tracks evaluation metrics across experimental arms **A0, A1, A2, and A3**, plus the **ZS-CRE-4B** zero-shot anchor baseline across all benchmark splits.

> [!NOTE]
> In accordance with Section 0 Rule 0.1, every metric or runtime not produced by an actual Python execution in this session MUST be written literally as `"NOT_MEASURED"`. Smoke-test runs must be labelled `"SMOKE_ONLY"`. Every item traces strictly to its execution run.

---

## 1. Experimental Arms

- **Arm A0 (Baseline Frozen Adapter):** Existing `FT-4B` adapter fine-tuned on `v1.1` data, re-evaluated with the corrected evaluation metrics and Option A policy (no retraining).
- **Arm A1 (v2 Data — Real-Repo Share Ablation Axis, Direct JSON Target):** `Qwen3-4B` fine-tuned on `v2` data with varying proportions of real student code vs synthetic mutations:
  - **A1-0%**: 0% real student code, 100% synthetic mutations (`real_repo_share = 0.0`).
  - **A1-20%**: 20% real student code, 80% synthetic mutations (`real_repo_share = 0.20`).
  - **A1-50%**: 50% real student code, 50% synthetic mutations (`real_repo_share = 0.50`).
  - **A1-80%**: 80% real student code, 20% synthetic mutations (`real_repo_share = 0.80`, Default Training Backbone).
- **Arm A2 (v2 Data — Label-Conditioned Rationale Generation):** `Qwen3-4B` fine-tuned on `v2` data with 14B teacher-generated 3-step reasoning traces (`Let's think step-by-step.` -> rubric criteria analysis -> JSON -> feedback) (`train_sft_distilled.jsonl`).
- **Arm A3 (Stage 2 NCA-Aligned Student):** Arm A2 adapter further aligned using Noise Contrastive Alignment (`nb2b_nca.ipynb`) with teacher gold traces as winners and student error outputs as losers.
- **Zero-Shot CRE Baseline (`ZS-CRE-4B`):** Base un-finetuned `Qwen3-4B` prompted with the v2 CRE prompt on Quiz 3 only (cost-effective reference anchor).

---

## 2. Evaluation Results Matrix

### Split: Held-Out Real Quiz 3 — Frozen `test` Split (n = 23 Students)
*Primary evaluation benchmark. Strictly held-out unseen students, untouched during training, prompt calibration, or tuning.*

| Arm | Mode | Exact Match % (95% CI) | Within ±3.3% | Within ±10% | MAE (95% CI) | Normalized Leniency $l_n$ | QWK | 5-Bin $\kappa_B$ | ICC3 | False-Penalty % (Full Marks) | Syntax False-Penalty % (Non-compiling) | False-Credit % | JSON Validity |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **A0** (v1.1 adapter) | Static | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A0** (v1.1 adapter) | Exec-Grounded | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A1** (v2 direct) | Static | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A1** (v2 direct) | Exec-Grounded | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A2** (v2 reasoning) | Static | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A2** (v2 reasoning) | Exec-Grounded | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A3** (A2 + NCA) | Static | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A3** (A2 + NCA) | Exec-Grounded | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **ZS-CRE-4B** (Zero-Shot) | Static | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **B_exec** (Exec-Only) | Exec-Only | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | 100.0% |

---

### Split: Real Quiz 3 — Complete Historical Set (n = 46 Students)
*Includes `dev` (23) and `test` (23) for direct comparison with prior README baseline numbers.*

| Arm | Mode | Exact Match % (95% CI) | Within ±10% | MAE (95% CI) | QWK | False-Penalty % (n=10) | Syntax False-Penalty % | Review % | Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **A0** (v1.1 adapter) | Static (Raw) | 23.91% [0.130, 0.370] | 28.26% | 2.076 [1.533, 2.631] | 0.375 | 80.0% (8/10) | NOT_MEASURED | 15.2% | Baseline from `output/real/real_metrics.json` |
| **A0** (v1.1 adapter) | Static (Cleaned) | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | Evaluated on `quiz3_clean/` |
| **A1** (v2 direct) | Static (Cleaned) | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | |
| **A2** (v2 reasoning) | Static (Cleaned) | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | |
| **A3** (A2 + NCA) | Static (Cleaned) | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | |
| **ZS-CRE-4B** | Static (Cleaned) | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | Base Qwen3-4B anchor |

---

### Split: Held-Out Real Tasks (`test_unseen_real_tasks` — IntroClass)
*Ingested introductory student tasks held out completely from training.*

| Arm | Tasks Evaluated | Exact Match % | Within ±10% | MAE | QWK | Criterion Accuracy | Leniency $l_n$ |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **A0** | `checksum`, `syllables` | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A1** | `checksum`, `syllables` | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A2** | `checksum`, `syllables` | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A3** | `checksum`, `syllables` | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |

---

### Split: Synthetic Test Sets (`test_unseen_synth` and `test_seen`)

| Arm | Split | Exact Match % (95% CI) | MAE (95% CI) | QWK | Criterion Accuracy | False-Penalty Rate | Review % |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **A0** | `test_seen` | 97.54% [0.951, 0.993] | 0.026 [0.007, 0.052] | 0.982 | 99.45% | 2.70% | 3.87% |
| **A0** | `test_unseen` | 73.93% [0.686, 0.793] | 0.429 [0.329, 0.541] | 0.896 | 92.54% | 13.33% | 8.57% |
| **A1** | `test_unseen_synth` | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A2** | `test_unseen_synth` | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A3** | `test_unseen_synth` | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |

---

## 3. Statistical Testing (Paired Wilcoxon on Held-Out Real Test)

*To be computed between Arm pairs with Holm-Bonferroni correction over absolute per-student errors:*
- **A1 vs A0:** $W = \text{NOT\_MEASURED}, p = \text{NOT\_MEASURED}$
- **A2 vs A1:** $W = \text{NOT\_MEASURED}, p = \text{NOT\_MEASURED}$
- **A3 vs A2:** $W = \text{NOT\_MEASURED}, p = \text{NOT\_MEASURED}$

---

## 4. Determinism & Degeneracy Diagnostics (Diaconu et al. 2026)

- **Order Permutation Invariance (n = 30):** `%` identical predictions when batch permutation order is shuffled under greedy decoding (`temperature=0.0`): `NOT_MEASURED`.
- **Prediction Variance:** Flag if any question produces $\sigma^2 < 0.01$ (constant output collapse): `NOT_MEASURED`.
- **Review-Flag Triage Curve:** Accuracy vs coverage tradeoff curve when routing flagged submissions to human instructors: `NOT_MEASURED`.
