"""Code-generated reasoning traces and feedback builder (Phase 1.7).

Follows Koutcheme et al. (SIGCSE 2026) 3-step structured format:
Step 1: "Let's think step-by-step." with rubric-by-rubric criteria analysis.
Step 2: Schema JSON block.
Step 3: Diagnostic feedback conditioned on the rubric evaluation.

Zero teacher models or external APIs are used. All evidence is strictly
derived from visible code line numbers, static checkers, or execution reports.
"""
import json
import random
from typing import Dict, List, Optional, Tuple, Any

from .schema import validate_grading_output
from .prompts import build_gold_output
from .mutations import MutationProvenance

# At least 5 varied phrasing templates per verdict type to prevent rigid memorization
VERDICT_TEMPLATES_FULL = [
    "Criterion '{cid}' ({desc}) is fully satisfied by the implementation on line(s) {lines}.",
    "The required logic for '{cid}' ({desc}) is correctly implemented on line(s) {lines} with no defects.",
    "Requirement '{cid}' ({desc}) is met: correct implementation demonstrated on line(s) {lines}.",
    "Line(s) {lines} properly address '{cid}' ({desc}), meeting all specifications.",
    "Full credit awarded for '{cid}' ({desc}) based on sound logic on line(s) {lines}."
]

VERDICT_TEMPLATES_FULL_NOLINES = [
    "Criterion '{cid}' ({desc}) is fully satisfied across the program structure.",
    "The student answer satisfies all requirements for '{cid}' ({desc}).",
    "Requirement '{cid}' ({desc}) is correctly met throughout the program flow.",
    "Full marks awarded for '{cid}' ({desc}) with no omissions detected.",
    "The required implementation for '{cid}' ({desc}) is present and correct."
]

VERDICT_TEMPLATES_DEDUCTION_CODE = [
    "Criterion '{cid}' ({desc}) is compromised: on line(s) {lines}, {issue}.",
    "Deduction applied to '{cid}' ({desc}) due to an error on line(s) {lines}: {issue}.",
    "Requirement '{cid}' ({desc}) is not met: line(s) {lines} show that {issue}.",
    "Defect identified in '{cid}' ({desc}) on line(s) {lines}: {issue}.",
    "Marks reduced for '{cid}' ({desc}) because line(s) {lines} {issue}."
]

VERDICT_TEMPLATES_DEDUCTION_ABSENT = [
    "Criterion '{cid}' ({desc}) lacks required logic: the implementation is missing or omitted.",
    "Deduction applied to '{cid}' ({desc}): the required logic is absent from the solution.",
    "Requirement '{cid}' ({desc}) is incomplete: fails to provide the necessary computation.",
    "Criterion '{cid}' ({desc}) is not satisfied: required operations are missing.",
    "Marks deducted for '{cid}' ({desc}) because the necessary constructs are absent."
]

VERDICT_TEMPLATES_DEDUCTION_EXEC = [
    "Criterion '{cid}' ({desc}) failed during execution: input '{inp}' produced output '{act}' instead of expected '{exp}'.",
    "Test failure under '{cid}' ({desc}): on input '{inp}', expected '{exp}' but received '{act}'.",
    "Deduction for '{cid}' ({desc}) grounded by runtime test failure: input '{inp}' yielded '{act}'.",
    "Requirement '{cid}' ({desc}) does not pass verification tests: actual output '{act}' differs from expected '{exp}'.",
    "Runtime verification failure for '{cid}' ({desc}): output '{act}' does not match expected '{exp}'."
]


def build_criterion_reasoning(
    cid: str,
    desc: str,
    awarded: float,
    max_m: float,
    evidence_lines: List[int],
    provenance_info: Optional[MutationProvenance],
    exec_report: Optional[dict],
    has_exec_report: bool,
    rng: random.Random
) -> Tuple[str, str]:
    """Generate one rubric step reasoning text and quality tag ('strong' or 'weak')."""
    lines_str = ", ".join(str(l) for l in sorted(evidence_lines)) if evidence_lines else ""
    quality = "strong"

    if awarded >= max_m - 0.01:
        # Full credit
        if lines_str:
            tmpl = rng.choice(VERDICT_TEMPLATES_FULL)
            text = tmpl.format(cid=cid, desc=desc, lines=lines_str)
        else:
            tmpl = rng.choice(VERDICT_TEMPLATES_FULL_NOLINES)
            text = tmpl.format(cid=cid, desc=desc)
    else:
        # Deduction
        if evidence_lines and provenance_info:
            issue = provenance_info.description
            tmpl = rng.choice(VERDICT_TEMPLATES_DEDUCTION_CODE)
            text = tmpl.format(cid=cid, desc=desc, lines=lines_str, issue=issue)
        elif has_exec_report and exec_report and exec_report.get("test_results"):
            # Ground deduction in visible test failure
            failing = [tc for tc in exec_report["test_results"] if not tc.get("passed")]
            if failing:
                tc = failing[0]
                inp = str(tc.get("stdin", "")).strip()[:40]
                exp = str(tc.get("expected", "")).strip()[:40]
                act = str(tc.get("actual", "")).strip()[:40]
                tmpl = rng.choice(VERDICT_TEMPLATES_DEDUCTION_EXEC)
                text = tmpl.format(cid=cid, desc=desc, inp=inp, exp=exp, act=act)
            else:
                tmpl = rng.choice(VERDICT_TEMPLATES_DEDUCTION_ABSENT)
                text = tmpl.format(cid=cid, desc=desc)
                quality = "weak"
        else:
            # Code deduction without visible line or report
            tmpl = rng.choice(VERDICT_TEMPLATES_DEDUCTION_ABSENT)
            text = tmpl.format(cid=cid, desc=desc)
            quality = "weak"

    return f"- {cid} ({desc}): {text} Marks awarded: {awarded}/{max_m}.", quality


def build_feedback(
    criteria: List[Dict[str, Any]],
    rubric_map: Dict[str, Dict[str, Any]],
    rng: random.Random
) -> str:
    """Build ≤3 sentence constructive diagnostic feedback following Koutcheme et al."""
    satisfied = [c for c in criteria if c["awarded"] >= rubric_map[c["id"]]["max_marks"] - 0.01]
    failed = [c for c in criteria if c["awarded"] < rubric_map[c["id"]]["max_marks"] - 0.01]

    sentences = []
    if satisfied:
        sat_descs = [rubric_map[c["id"]]["description"].lower() for c in satisfied[:2]]
        sentences.append(f"Good job on correctly implementing {' and '.join(sat_descs)}.")
    else:
        sentences.append("Your code shows an initial attempt at the problem structure.")

    if failed:
        f1 = failed[0]
        f1_desc = rubric_map[f1["id"]]["description"].lower()
        f1_comment = f1.get("comment", "")
        if f1.get("evidence_lines"):
            sentences.append(f"Check line(s) {', '.join(str(l) for l in f1['evidence_lines'])} regarding {f1_desc} ({f1_comment}).")
        else:
            sentences.append(f"Review the requirements for {f1_desc}: {f1_comment}.")
        
        if len(failed) > 1:
            f2 = failed[1]
            f2_desc = rubric_map[f2["id"]]["description"].lower()
            sentences.append(f"Also verify your handling of {f2_desc}.")
    else:
        sentences.append("All rubric specifications are fully satisfied.")

    return " ".join(sentences[:3])


def build_reasoning_trace(
    rubric: List[Dict[str, Any]],
    student_answer_lineno: str,
    gold_criteria: List[Dict[str, Any]],
    needs_human_review: bool,
    provenance_map: Optional[Dict[str, MutationProvenance]] = None,
    execution_report: Optional[dict] = None,
    include_feedback: bool = True,
    seed: int = 42
) -> Tuple[str, str, Dict[str, Any]]:
    """Build complete Step 1 reasoning + Step 2 JSON + Step 3 feedback completion.
    
    Returns:
      (full_target_text, trace_quality, gold_json_dict)
    """
    rng = random.Random(seed)
    rubric_map = {c["id"]: c for c in rubric}
    gold_map = {c["id"]: c for c in gold_criteria}
    provenance_map = provenance_map or {}

    has_exec = isinstance(execution_report, dict) and execution_report.get("available") is not False

    step1_lines = ["Let's think step-by-step."]
    overall_quality = "strong"

    for r_item in rubric:
        cid = r_item["id"]
        desc = r_item["description"]
        max_m = r_item["max_marks"]
        gc = gold_map.get(cid, {"awarded": 0.0, "comment": "Missing", "evidence_lines": []})
        awarded = gc["awarded"]
        ev_lines = gc.get("evidence_lines", [])
        prov = provenance_map.get(cid)

        reasoning_text, quality = build_criterion_reasoning(
            cid=cid,
            desc=desc,
            awarded=awarded,
            max_m=max_m,
            evidence_lines=ev_lines,
            provenance_info=prov,
            exec_report=execution_report,
            has_exec_report=has_exec,
            rng=rng
        )
        step1_lines.append(reasoning_text)
        if quality == "weak":
            overall_quality = "weak"

    reasoning_block = "\n".join(step1_lines)
    json_block = build_gold_output(gold_criteria, needs_human_review)

    feedback_block = ""
    if include_feedback:
        feedback_text = build_feedback(gold_criteria, rubric_map, rng)
        feedback_block = f"\n\nFeedback:\n{feedback_text}"

    full_target = f"{reasoning_block}\n\n{json_block}{feedback_block}"

    # Strict validation of generated trace
    is_valid, errors = validate_grading_output(
        json_block,
        rubric,
        student_answer_lineno,
        execution_report=execution_report
    )
    if not is_valid:
        raise ValueError(f"Trace builder produced invalid schema JSON: {errors}")

    return full_target, overall_quality, {"criteria": gold_criteria, "needs_human_review": needs_human_review}

