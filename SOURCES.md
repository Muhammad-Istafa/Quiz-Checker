# External Repository Sources & Attribution (`SOURCES.md`)

This document records the provenance, licensing, dataset layout, task selection, and usage policies for external real student code repositories integrated into the `v2` benchmark pipeline.

---

## 1. Summary of Repositories

| Repository | Source URL | Content & Scope | License / Consent | Role in Pipeline |
| :--- | :--- | :--- | :--- | :--- |
| **IntroClass** | `https://github.com/ProgramRepair/IntroClass` | 73,882 C student programs across 6 introductory assignments from undergraduate CS1 students (UC Davis). | Public research benchmark (Le Goues et al., FSE 2015). Anonymized student hashes. | Real student code track (`real_repo`). Ingested for `digits`, `median`, `smallest`. Held out: `checksum`, `syllables`. |
| **C-Pack-IPAs** | `https://github.com/pmorvalho/C-Pack-IPAs` | 25 introductory C lab assignments from IST Lisbon with correct, semantic-bug, and syntax-error submissions. | Strictly for academic research use. Anonymized undergraduate submissions. | Style pool and test suite reference. Evaluated with standard compiler flags (ignoring `-ansi -pedantic -Werror`). |
| **ITSP** | `https://github.com/jyi/ITSP` | IIT Kanpur CS-101 C programming lab tasks with buggy/fixed student program pairs and input/output suites. | Public academic benchmark for automated program repair. | Buggy→fixed diffs provide ground-truth evidence lines for code-generated reasoning traces. |
| **Deep-Grader** | `https://github.com/peter-nagy1/Deep-Grader` | 168,110 C++ competitive programming solutions from Codeforces across 992 problems (Nagy, MSc thesis). | Academic research code. Private/restricted access where noted. | Style-only pool; excluded from rubric training to avoid competitive programming distribution shift. |
| **Codeflaws / CodeNet** | GitHub / IBM CodeNet | Human defects from Codeforces and university contests. | Open research data. | Style reference and bug operator pattern discovery. |

---

## 2. Ingested Tasks & Approach-Agnostic Rubrics

Each task selected from IntroClass represents introductory programming fundamentals (I/O, arithmetic, loops, conditionals, strings). In accordance with **Phase 1 (Section 4.1 & 4.6)**, all rubrics total **10.0 marks** and describe *what* must be achieved rather than *how*:

### Task 1: `introclass_digits` (Train / Seen)
- **Problem:** Read an integer and print its digits in reverse, one per line.
- **Rubric (10.0 marks):**
  - `digits_input` (2.0): Reads integer input correctly from stdin.
  - `digits_extraction` (4.0): Correctly extracts digits using modulo and integer division arithmetic.
  - `digits_display` (2.0): Outputs each digit on a separate line.
  - `digits_flow` (2.0): Handles zero and loop termination without infinite looping.

### Task 2: `introclass_median` (Train / Seen)
- **Problem:** Read three integers and output their median (middle value).
- **Rubric (10.0 marks):**
  - `med_input` (2.0): Reads 3 integer values from stdin.
  - `med_compare` (5.0): Correctly compares all 3 values (via chained `if/else`, sorting, or min/max).
  - `med_output` (3.0): Outputs the exact median value.

### Task 3: `introclass_smallest` (Train / Seen)
- **Problem:** Read four integers and output the smallest value.
- **Rubric (10.0 marks):**
  - `sml_input` (2.0): Reads 4 integers from stdin.
  - `sml_logic` (5.0): Determines the minimum value across all four inputs.
  - `sml_output` (3.0): Outputs the smallest integer.

---

## 3. Held-Out Tasks for Generalization (`test_unseen_real_tasks`)

As required by **Section 4.6**, two complete repository tasks are held out and never seen during training or prompt tuning:

### Held-Out Task 1: `introclass_checksum`
- **Problem:** Read a line of text and compute its 8-bit checksum as the sum of ASCII values modulo 64 offset by space character.
- **Rubric (10.0 marks):**
  - `chk_input` (2.0): Reads line of characters/string from stdin.
  - `chk_sum` (4.0): Accumulates character ASCII values accurately.
  - `chk_modulo` (2.0): Applies modulo arithmetic (`% 64`).
  - `chk_output` (2.0): Prints the final checksum character.

### Held-Out Task 2: `introclass_syllables`
- **Problem:** Read a string and count the number of vowels (`a, e, i, o, u, y`, case-insensitive).
- **Rubric (10.0 marks):**
  - `syl_input` (2.0): Reads input string.
  - `syl_loop` (3.0): Iterates through each character in sequence.
  - `syl_check` (3.0): Accurately identifies vowel characters (including case insensitivity).
  - `syl_output` (2.0): Prints the total vowel count.

---

## 4. Deduplication & Stratification Policy

1. **Normalized-AST Deduplication:** Student submissions with identical AST structure (stripping comments, formatting, and identifier names) are deduplicated to prevent data skew.
2. **Score-Band Capping:** Submissions are capped per task and balanced across score tiers (0–2, 2.5–5, 5.5–8, 8.5–10) so no single repository or task dominates the training mixture.
3. **Provenance Tagging:** All records carry `origin: "real_repo"` and `label_source: "rule"`. Metrics are evaluated and reported separately by origin, never pooled blindly with synthetic data.

---

## 5. Kaggle Distribution Mechanism & Licensing Compliance (Requirement 8)

### How Repositories Reach Kaggle
Real student code repositories are uploaded as a private Kaggle dataset named `cpp-grader-repos` and mounted into the Kaggle notebook session at `/kaggle/input/cpp-grader-repos/` (with local workspace fallback to `repos/`).
Directory structure within the dataset:
```
cpp-grader-repos/
├── IntroClass/             # UC Davis CS1 tasks (digits, median, smallest, grade, checksum, syllables)
├── C-Pack-IPAs/            # IST Lisbon Lab02-Lab04 tasks (correct, semantically/syntactically incorrect)
└── ITSP/                   # IIT Kanpur CS101 lab tasks (Lab-3 to Lab-12 buggy/correct pairs)
```

### Licences & Terms of Use
1. **`IntroClass`**:
   - **License:** MIT License (permissive open-source).
   - **Citation:** Le Goues et al., "The ManyBugs and IntroClass Benchmarks for Automated Repair of C Programs", IEEE TSE 2015.
   - **Privacy:** All student user IDs are anonymized hashes (`070455301...`).
2. **`C-Pack-IPAs`**:
   - **License:** Strictly for Academic & Research Use Only.
   - **Citation:** Pedro Morvalho et al., "C-Pack-IPAs: A Dataset of Introductory Programming Assignments in C", INESC-ID / Instituto Superior Técnico, Universidade de Lisboa.
   - **Privacy:** Anonymized student tokens (`stu_001`, `stu_002`, etc.).
3. **`ITSP`**:
   - **License:** Academic Research License.
   - **Citation:** J. Yi et al., "A Dataset of Real-World Student Programming Errors", IIT Kanpur CS101.
   - **Privacy:** Anonymized student program IDs (`270010`, `270011`, etc.).

### Firewall Around FAST NUCES Quiz 3
The FAST NUCES Quiz 3 benchmark files (`Quiz3-1E.zip`, `Quiz3_1E.xlsx`, `quiz3_split.json`) are maintained in a separate private evaluation dataset (`cpp-grader-quiz3-eval`) and are strictly excluded from `cpp-grader-repos` and any training distribution to guarantee zero training contamination.

