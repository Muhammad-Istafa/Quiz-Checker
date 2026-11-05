# Benchmark Experiment Matrix & Tracking Template (`EXPERIMENTS.md`)

This template tracks evaluation metrics across experimental arms **A0, A1, A2, and A3** across all benchmark splits.

> [!NOTE]
> In accordance with Section 0 Rule 0.2, rows must cite their execution date, environment, and run hash. Smoke runs must be marked `[SMOKE]`.

---

## 1. Experimental Arms

- **Arm A0 (Baseline Frozen Adapter):** Existing `FT-4B` adapter fine-tuned on `v1.1` data, re-evaluated with the corrected evaluation metrics and Option A policy (no retraining).
- **Arm A1 (v2 Data â€” Direct JSON Target):** `Qwen3-4B` fine-tuned on `v2` multi-template data with execution report dropout (35%), outputting JSON directly. Isolates the effect of data diversification and execution dropout.
- **Arm A2 (v2 Data â€” Structured Reasoning Target):** `Qwen3-4B` fine-tuned on `v2` data with code-generated chain-of-thought traces (`Let's think step-by-step.` -> rubric criteria analysis -> JSON -> feedback). Isolates the effect of structured reasoning.
- **Arm A3 (A2 + NCA Preference Stage):** Arm A2 adapter further aligned using Noise Contrastive Alignment (`nb2b_nca.ipynb`) with code-generated gold traces as winners and student error outputs as losers.

---

## 2. Evaluation Results Matrix

### Split: Held-Out Real Quiz 3 â€” Frozen `test` Split (n = 23 Students)
*Primary evaluation benchmark. Unseen students, untouched during training, prompt calibration, or tuning.*

| Arm | Mode | Exact Match % (95% CI) | Within Â±10% | MAE (95% CI) | Normalized Leniency | QWK (Kappa) | False-Penalty % (n=5) | False-Credit % | JSON Validity |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **A0** (v1.1 adapter) | Static | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A0** (v1.1 adapter) | Exec-Grounded | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A1** (v2 direct) | Static | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A1** (v2 direct) | Exec-Grounded | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A2** (v2 reasoning) | Static | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A2** (v2 reasoning) | Exec-Grounded | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A3** (A2 + NCA) | Static | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **A3** (A2 + NCA) | Exec-Grounded | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| **B_exec** (Exec-Only) | Exec-Only | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | 100.0% |

---

### Split: Real Quiz 3 â€” Complete Historical Set (n = 46 Students)
*Includes `dev` (23) and `test` (23) for direct comparison with prior README baseline numbers.*

| Arm | Mode | Exact Match % (95% CI) | Within Â±10% | MAE (95% CI) | QWK (Kappa) | False-Penalty % (n=10) | Review % | Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **A0** (v1.1 adapter) | Static (Raw) | 23.91% [0.130, 0.370] | 28.26% | 2.076 [1.533, 2.631] | 0.375 | 80.0% (8/10) | 15.2% | Baseline from `output/real/real_metrics.json` |
| **A0** (v1.1 adapter) | Static (Cleaned) | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | Evaluated on `quiz3_clean/` |
| **A1** (v2 direct) | Static (Cleaned) | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | |
| **A2** (v2 reasoning) | Static (Cleaned) | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | |
| **A3** (A2 + NCA) | Static (Cleaned) | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | |

---

### Split: Held-Out Real Tasks (`test_unseen_real_tasks` â€” IntroClass)
*Ingested introductory student tasks held out completely from training.*

| Arm | Tasks Evaluated | Exact Match % | Within Â±10% | MAE | QWK | Criterion Accuracy | Leniency |
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

## 4. Determinism & Degeneracy Diagnostics

- **Order Permutation Invariance (n = 30):** `%` identical predictions when batch permutation order is shuffled under greedy decoding (`temperature=0.0`).
- **Prediction Variance:** Flag if any question produces $\sigma^2 < 0.01$ (constant output collapse).


