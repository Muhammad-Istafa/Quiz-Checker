"""Deterministic parser for structured grading output (Phase 2 & Phase 4).

Extracts and validates:
1. Reasoning trace (starts with "Let's think step-by-step.")
2. Schema JSON block (criteria breakdown, evidence_lines, needs_human_review)
3. Diagnostic feedback block (optional post-JSON text)

Totals are computed by code, never trusted from model text.
Strictly reports and counts parser failures instead of silent clamping.
"""
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from .schema import validate_grading_output

_REASONING_PREFIX = "Let's think step-by-step."
_JSON_BLOCK_RE = re.compile(r"(\{[\s\S]*\"criteria\"[\s\S]*\"needs_human_review\"[\s\S]*\})", re.DOTALL)


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
        failure_reason: Optional[str] = None
    ):
        super().__init__(
            valid=valid,
            parsed=parsed,
            reasoning=reasoning,
            feedback=feedback,
            raw_json_str=raw_json_str,
            errors=errors,
            failure_reason=failure_reason
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



def extract_reasoning_and_json(text: str) -> Tuple[str, str, str]:
    """Split completion into (reasoning, json_str, feedback).
    
    If format matches Phase 2:
    - Reasoning comes before the final JSON object.
    - JSON is the target grading object.
    - Feedback is any text following the closing JSON brace.
    """
    clean = text.strip()
    
    # Check for JSON block
    match = _JSON_BLOCK_RE.search(clean)
    if not match:
        # Fallback: look for outermost curly braces containing "criteria"
        c_pos = clean.find('"criteria"')
        if c_pos != -1:
            start = clean.rfind("{", 0, c_pos)
            end = clean.rfind("}")
            if start != -1 and end != -1 and end > start:
                json_candidate = clean[start:end + 1]
                reasoning = clean[:start].strip()
                feedback = clean[end + 1:].strip()
                return reasoning, json_candidate, feedback
        return clean, "", ""
    
    start_idx, end_idx = match.span(1)
    # Extract exact balanced JSON from start_idx
    depth = 0
    in_string = False
    escape = False
    exact_end = -1

    for i in range(start_idx, len(clean)):
        char = clean[i]
        if escape:
            escape = False
            continue
        if char == "\\":
            escape = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if not in_string:
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    exact_end = i + 1
                    break

    if exact_end != -1:
        json_str = clean[start_idx:exact_end].strip()
        reasoning = clean[:start_idx].strip()
        feedback = clean[exact_end:].strip()
    else:
        json_str = match.group(1).strip()
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
    """Strictly parse and validate model completion.
    
    Returns a ParseResult object (supporting both dict keys and attributes):
      - valid / is_valid: bool
      - parsed: dict with 'criteria', 'total', 'needs_human_review' (or None)
      - reasoning: str
      - feedback: str
      - raw_json_str: str
      - errors: list of error strings
      - failure_reason: str (or None)
      - failure_types: list of failure reasons
      - criteria: list of criterion dicts
      - total_marks: float
      - needs_human_review: bool
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
            failure_reason="missing_json"
        )

    is_valid, errors = validate_grading_output(
        json_str,
        rubric,
        student_answer_lineno,
        execution_report=execution_report,
        policy=policy
    )

    if not is_valid:
        failure_type = "invalid_schema"
        if any("JSON parse" in e for e in errors):
            failure_type = "json_syntax_error"
        elif any("Missing criteria" in e or "Unknown criterion" in e for e in errors):
            failure_type = "criterion_id_mismatch"
        elif any("not in [0," in e for e in errors):
            failure_type = "out_of_range_marks"

        return ParseResult(
            valid=False,
            parsed=None,
            reasoning=reasoning,
            feedback=feedback,
            raw_json_str=json_str,
            errors=errors,
            failure_reason=failure_type
        )

    # If valid, load and sum total in code
    data = json.loads(json_str)
    # Compute total strictly in code
    computed_total = round(sum(float(c.get("awarded", 0.0)) for c in data.get("criteria", [])) * 2) / 2.0
    data["total"] = computed_total

    return ParseResult(
        valid=True,
        parsed=data,
        reasoning=reasoning,
        feedback=feedback,
        raw_json_str=json_str,
        errors=[],
        failure_reason=None
    )

