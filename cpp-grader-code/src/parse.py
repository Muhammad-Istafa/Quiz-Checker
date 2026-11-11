"""Deterministic parser for structured grading output (Phase 2 & Phase 4).

Extracts and validates:
1. Reasoning trace (starts with "Let's think step-by-step.")
2. Schema JSON block (criteria breakdown, evidence_lines, needs_human_review)
3. Diagnostic feedback block (optional post-JSON text)

Totals are computed strictly by Python code outside the LLM (Pathak et al., CRE),
never trusted from model text.
Strictly reports and counts parser failures and out-of-range marks instead of silent clamping.
"""
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from .schema import validate_grading_output

_REASONING_PREFIX = "Let's think step-by-step."


class ParseResult(dict):
    """Result object supporting both dict indexing and attribute access."""
    def __init__(
        self,
        valid: bool,
        parsed: Optional[Dict[str, Any]],
        reasoning: str,
        feedback: str,
        raw_json_str: str,
        errors: List[str],
        failure_reason: Optional[str] = None,
        out_of_range_count: int = 0
    ):
        super().__init__(
            valid=valid,
            parsed=parsed,
            reasoning=reasoning,
            feedback=feedback,
            raw_json_str=raw_json_str,
            errors=errors,
            failure_reason=failure_reason,
            out_of_range_count=out_of_range_count
        )

    @property
    def valid(self) -> bool:
        return self["valid"]

    @property
    def is_valid(self) -> bool:
        return self["valid"]

    @property
    def parsed(self) -> Optional[Dict[str, Any]]:
        return self["parsed"]

    @property
    def reasoning(self) -> str:
        return self["reasoning"]

    @property
    def feedback(self) -> str:
        return self["feedback"]

    @property
    def raw_json_str(self) -> str:
        return self["raw_json_str"]

    @property
    def errors(self) -> List[str]:
        return self["errors"]

    @property
    def failure_reason(self) -> Optional[str]:
        return self["failure_reason"]

    @property
    def failure_types(self) -> List[str]:
        return [self["failure_reason"]] if self["failure_reason"] else []

    @property
    def criteria(self) -> List[Dict[str, Any]]:
        return self["parsed"].get("criteria", []) if self["parsed"] else []

    @property
    def total_marks(self) -> float:
        return self["parsed"].get("total", 0.0) if self["parsed"] else 0.0

    @property
    def needs_human_review(self) -> bool:
        return self["parsed"].get("needs_human_review", False) if self["parsed"] else True

    @property
    def out_of_range_count(self) -> int:
        return self.get("out_of_range_count", 0)


def extract_reasoning_and_json(text: str) -> Tuple[str, str, str]:
    """Split completion into (reasoning, json_str, feedback).
    
    Robustly extracts the LAST balanced JSON object containing 'criteria'.
    - Reasoning comes before that balanced JSON block.
    - JSON is the target grading object.
    - Feedback is any text following the closing JSON brace.
    """
    clean = text.strip()
    if '"criteria"' not in clean:
        return clean, "", ""

    # Find all balanced JSON candidates containing '"criteria"'
    candidates: List[Tuple[int, int, str]] = []
    n = len(clean)
    for i in range(n):
        if clean[i] == '{':
            depth = 0
            in_string = False
            escape = False
            for j in range(i, n):
                char = clean[j]
                if escape:
                    escape = False
                    continue
                if char == '\\':
                    escape = True
                    continue
                if char == '"':
                    in_string = not in_string
                    continue
                if not in_string:
                    if char == '{':
                        depth += 1
                    elif char == '}':
                        depth -= 1
                        if depth == 0:
                            sub = clean[i:j + 1]
                            if '"criteria"' in sub:
                                candidates.append((i, j + 1, sub))
                            break

    if not candidates:
        # Fallback: search between first '{' before "criteria" and last '}'
        c_pos = clean.rfind('"criteria"')
        start = clean.rfind("{", 0, c_pos)
        end = clean.rfind("}")
        if start != -1 and end != -1 and end > start:
            return clean[:start].strip(), clean[start:end + 1].strip(), clean[end + 1:].strip()
        return clean, "", ""

    # Pick the LAST balanced block
    start_idx, end_idx, json_str = candidates[-1]
    reasoning = clean[:start_idx].strip()
    feedback = clean[end_idx:].strip()
    return reasoning, json_str, feedback


def parse_and_validate_output(
    completion: str,
    rubric: List[Dict[str, Any]],
    student_answer_lineno: str,
    execution_report: Optional[Dict[str, Any]] = None,
    policy: str = "option_a"
) -> ParseResult:
    """Strictly parse and validate model completion without silent clamping.
    
    Returns a ParseResult object:
      - valid / is_valid: bool
      - parsed: dict with 'criteria', 'total', 'needs_human_review' (or None)
      - reasoning: str
      - feedback: str
      - raw_json_str: str
      - errors: list of error strings
      - failure_reason: str (or None)
      - failure_types: list of failure reasons
      - criteria: list of criterion dicts
      - total_marks: float (computed in Python outside LLM)
      - needs_human_review: bool
      - out_of_range_count: int
    """
    reasoning, json_str, feedback = extract_reasoning_and_json(completion)
    
    if not json_str:
        return ParseResult(
            valid=False,
            parsed=None,
            reasoning=reasoning,
            feedback=feedback,
            raw_json_str="",
            errors=["No JSON object with 'criteria' found in completion"],
            failure_reason="missing_json",
            out_of_range_count=0
        )

    # Pre-check for raw JSON syntax
    try:
        raw_data = json.loads(json_str)
    except (json.JSONDecodeError, TypeError) as e:
        return ParseResult(
            valid=False,
            parsed=None,
            reasoning=reasoning,
            feedback=feedback,
            raw_json_str=json_str,
            errors=[f"JSON parse error: {e}"],
            failure_reason="json_syntax_error",
            out_of_range_count=0
        )

    # Check for out-of-range marks before validation (Bug Fix 1: NEVER clamp)
    rubric_map = {c["id"]: c for c in rubric}
    out_of_range_count = 0
    if isinstance(raw_data, dict) and isinstance(raw_data.get("criteria"), list):
        for crit in raw_data["criteria"]:
            if isinstance(crit, dict):
                cid = crit.get("id")
                awarded = crit.get("marks_awarded", crit.get("awarded", None))
                if awarded is not None and isinstance(awarded, (int, float)) and not isinstance(awarded, bool):
                    max_m = rubric_map.get(cid, {}).get("max_marks", 10.0)
                    if awarded < 0 or awarded > max_m:
                        out_of_range_count += 1

    is_valid, errors = validate_grading_output(
        json_str,
        rubric,
        student_answer_lineno,
        execution_report=execution_report,
        policy=policy
    )

    if not is_valid:
        failure_type = "invalid_schema"
        if out_of_range_count > 0 or any("not in [0," in e for e in errors):
            failure_type = "out_of_range_marks"
        elif any("JSON parse" in e for e in errors):
            failure_type = "json_syntax_error"
        elif any("Missing criteria" in e or "Unknown criterion" in e for e in errors):
            failure_type = "criterion_id_mismatch"

        return ParseResult(
            valid=False,
            parsed=None,
            reasoning=reasoning,
            feedback=feedback,
            raw_json_str=json_str,
            errors=errors,
            failure_reason=failure_type,
            out_of_range_count=out_of_range_count
        )

    # Compute total strictly in Python code outside LLM (Pathak et al. CRE)
    # Support both marks_awarded and awarded transparently
    for c in raw_data.get("criteria", []):
        if isinstance(c, dict):
            m = float(c.get("marks_awarded", c.get("awarded", 0.0)))
            c["marks_awarded"] = m
            c["awarded"] = m
            comm = c.get("justification", c.get("comment", ""))
            c["justification"] = comm
            c["comment"] = comm

    computed_total = round(
        sum(
            float(c.get("marks_awarded", 0.0))
            for c in raw_data.get("criteria", [])
        ) * 2
    ) / 2.0
    raw_data["total"] = computed_total

    return ParseResult(
        valid=True,
        parsed=raw_data,
        reasoning=reasoning,
        feedback=feedback,
        raw_json_str=json_str,
        errors=[],
        failure_reason=None,
        out_of_range_count=0
    )
