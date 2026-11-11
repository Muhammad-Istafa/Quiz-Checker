"""Single source of truth for the grading output schema and its validator.

Every notebook (NB1 data, NB1b teacher, NB2 training, NB2b NCA, NB3 evaluation) imports this module.
Do not copy the validator into a notebook; import it.
"""
import json
import os
import re
from typing import List, Optional, Tuple, Dict, Any

_SCHEMA_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "config", "schema_version.txt",
)


def _read_schema_version() -> str:
    if not os.path.isfile(_SCHEMA_FILE):
        return "v3.1"
    try:
        with open(_SCHEMA_FILE, "r", encoding="utf-8") as f:
            v = f.read().strip()
            return v if v else "v3.1"
    except Exception:
        return "v3.1"


SCHEMA_VERSION: str = _read_schema_version()

# A deduction with no evidence lines must explain what is absent (README 6.5).
ABSENCE_MARKERS: Tuple[str, ...] = (
    "missing", "omit", "absent", "lacks", "not found", "fails to",
    "unhandled", "unreadable", "without", "no ", "never", "not present",
    "did not", "does not", "incomplete",
)

# Numbered student code uses "<n>| <code>" (see prompts.add_line_numbers).
_LINE_PREFIX_RE = re.compile(r"^\s*\d+\|\s?")


def strip_line_number(numbered_line: str) -> str:
    """Remove the '<n>| ' prefix from one numbered line."""
    return _LINE_PREFIX_RE.sub("", numbered_line, count=1)


def has_absence_marker(comment: str) -> bool:
    low = comment.lower()
    return any(m in low for m in ABSENCE_MARKERS)


def validate_grading_output(
    output_json: str,
    rubric: list,
    student_answer_lineno: str,
    execution_report: Optional[dict] = None,
    policy: str = "option_a"
) -> Tuple[bool, List[str]]:
    """Validate one grading output against the rubric and the numbered student code.

    Returns (ok, errors). Checks:
    - JSON object with 'criteria' list and 'needs_human_review' boolean.
    - No 'total' (total is computed in Python outside the LLM).
    - Known, unique, and complete criterion IDs.
    - Marks awarded in [0, max_marks] and 0.5 increments. NEVER clamps out-of-range marks.
    - Supports both 'awarded'/'marks_awarded' and 'comment'/'justification' transparently.
    - Substantive explanation (>= 3 words).
    - Grounded integer evidence lines within code bounds.
    - Explanation of missing logic for evidence-free deductions.
    - Pure Logical Rubric Evaluation: compilation failures NEVER gate or penalize logical criteria.
    """
    errors: List[str] = []
    try:
        data = json.loads(output_json)
    except (json.JSONDecodeError, TypeError) as e:
        return False, [f"JSON parse error: {e}"]

    if not isinstance(data, dict):
        return False, ["Output is not a JSON object"]

    for key in ("criteria", "needs_human_review"):
        if key not in data:
            errors.append(f"Missing key '{key}'")
    if errors:
        return False, errors

    if not isinstance(data["criteria"], list):
        return False, ["'criteria' must be a list"]
    if not isinstance(data["needs_human_review"], bool):
        errors.append("'needs_human_review' must be a boolean")
    if "total" in data:
        errors.append("Output must not contain 'total' (sum in code)")
    # Note: If max or max_marks is present in a criterion, do not fail unless it conflicts
    rubric_map = {c["id"]: c for c in rubric}
    rubric_ids = set(rubric_map)
    output_ids = set()

    answer_lines = student_answer_lineno.split("\n")
    n_lines = len(answer_lines)

    for crit in data["criteria"]:
        if not isinstance(crit, dict):
            errors.append("Criterion is not a dict")
            continue

        cid = crit.get("id")
        if not cid:
            errors.append("Criterion missing key 'id'")
            continue

        if cid not in rubric_ids:
            errors.append(f"Unknown criterion id '{cid}'")
            continue
        if cid in output_ids:
            errors.append(f"Duplicate criterion id '{cid}'")
            continue
        output_ids.add(cid)

        # Dual support for awarded / marks_awarded
        has_mark = ("marks_awarded" in crit) or ("awarded" in crit)
        if not has_mark:
            errors.append(f"'{cid}': missing key 'awarded' or 'marks_awarded'")
            awarded = None
        else:
            awarded = crit.get("marks_awarded", crit.get("awarded"))
            # Normalize in-place
            crit["awarded"] = awarded
            crit["marks_awarded"] = awarded

        max_m = rubric_map[cid]["max_marks"]
        awarded_is_num = isinstance(awarded, (int, float)) and not isinstance(awarded, bool)
        if not awarded_is_num:
            errors.append(f"'{cid}': awarded mark not a valid number")
        else:
            # Bug Fix 1: Record error, NEVER clamp!
            if awarded < 0 or awarded > max_m:
                errors.append(f"'{cid}': awarded {awarded} not in [0, {max_m}]")
            if (awarded * 2) % 1 != 0:
                errors.append(f"'{cid}': awarded {awarded} not in 0.5 increments")

        # Dual support for comment / justification
        has_comment = ("justification" in crit) or ("comment" in crit)
        if not has_comment:
            errors.append(f"'{cid}': missing key 'comment' or 'justification'")
            comment = ""
        else:
            comment = crit.get("justification", crit.get("comment", ""))
            crit["comment"] = comment
            crit["justification"] = comment

        if not isinstance(comment, str) or not comment.strip():
            errors.append(f"'{cid}': comment must be non-empty")
            comment = ""
        elif len(comment.split()) < 3:
            errors.append(f"'{cid}': comment must be a substantive explanation (>= 3 words)")

        # Evidence lines
        if "evidence_lines" not in crit:
            errors.append(f"'{cid}': missing key 'evidence_lines'")
            ev_lines = []
        else:
            ev_lines = crit.get("evidence_lines", [])

        if not isinstance(ev_lines, list):
            errors.append(f"'{cid}': evidence_lines must be a list")
            ev_lines = []
        else:
            for ln in ev_lines:
                if not isinstance(ln, int) or isinstance(ln, bool):
                    errors.append(f"'{cid}': evidence_lines must contain integers, got {ln!r}")
                elif ln < 1 or ln > n_lines:
                    errors.append(f"'{cid}': line {ln} out of range [1, {n_lines}]")
                elif not strip_line_number(answer_lines[ln - 1]).strip():
                    errors.append(f"'{cid}': cited evidence line {ln} is empty/blank (ungrounded citation)")

        if awarded_is_num and awarded < max_m and not ev_lines and comment:
            if not has_absence_marker(comment):
                errors.append(
                    f"'{cid}': deduction made without evidence_lines, but comment "
                    "does not explain what is missing/absent"
                )

    missing = rubric_ids - output_ids
    if missing:
        errors.append(f"Missing criteria: {sorted(missing)}")

    # Pure Logical Rubric Grading (Pathak et al. CRE):
    # Only if the rubric has an explicit compilation/syntax criterion does compile failure deduct marks.
    # Non-compiling code must NOT receive penalties on logical criteria.
    if isinstance(execution_report, dict) and execution_report.get("compile_ok") is False:
        for c in data.get("criteria", []):
            if not isinstance(c, dict):
                continue
            cid = str(c.get("id", ""))
            if any(t in cid.lower() for t in ("comp", "syntax", "compile")):
                if c.get("awarded") == rubric_map.get(cid, {}).get("max_marks"):
                    errors.append(f"'{cid}': full marks awarded despite compile failure in execution report")

    return len(errors) == 0, errors
