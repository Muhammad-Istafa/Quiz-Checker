# ============================================================================
# 4B. ANTI-HALLUCINATION POST-PROCESSOR (VERIFIER)
# ============================================================================
import json, re, builtins
from typing import Optional, List, Tuple

ABSENCE_MARKERS: Tuple[str, ...] = (
    "missing", "omit", "absent", "lacks", "not found", "fails to",
    "unhandled", "unreadable", "without", "no ", "never",
)
_LINE_PREFIX_RE = re.compile(r"^\s*\d+\|\s?")

def strip_line_number(numbered_line: str) -> str:
    return _LINE_PREFIX_RE.sub("", numbered_line, count=1)

def has_absence_marker(comment: str) -> bool:
    return any(m in comment.lower() for m in ABSENCE_MARKERS)

def validate_grading_output(output_json: str, rubric: list, student_answer_lineno: str,
                            execution_report: Optional[dict] = None) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    try:
        data = json.loads(output_json)
    except Exception as e:
        return False, [f"JSON parse error: {e}"]
    if not isinstance(data, dict):
        return False, ["Output is not a JSON object"]
    for key in ("criteria", "needs_human_review"):
        if key not in data: errors.append(f"Missing key '{key}'")
    if errors: return False, errors
    if not isinstance(data["criteria"], list): return False, ["'criteria' must be a list"]
    if not isinstance(data["needs_human_review"], bool): errors.append("'needs_human_review' must be a boolean")
    if "total" in data: errors.append("Output must not contain 'total'")
    if any("max" in c for c in data["criteria"] if isinstance(c, dict)):
        errors.append("Criteria must not contain 'max'")

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
        if cid not in rubric_ids:
            errors.append(f"Unknown criterion id '{cid}'")
            continue
        if cid in output_ids:
            errors.append(f"Duplicate criterion id '{cid}'")
            continue
        output_ids.add(cid)

        awarded = crit.get("awarded", -1)
        max_m = rubric_map[cid]["max_marks"]
        if not isinstance(awarded, (int, float)) or isinstance(awarded, bool):
            errors.append(f"'{cid}': awarded not a number")
        else:
            if awarded < 0 or awarded > max_m:
                errors.append(f"'{cid}': awarded {awarded} not in [0, {max_m}]")
            if (awarded * 2) % 1 != 0:
                errors.append(f"'{cid}': awarded {awarded} not in 0.5 increments")

        comment = str(crit.get("comment", "")).strip()
        if not comment:
            errors.append(f"'{cid}': comment must be non-empty")
        elif len(comment.split()) < 3:
            errors.append(f"'{cid}': comment must be a substantive explanation (>= 3 words)")

        ev_lines = crit.get("evidence_lines", [])
        if not isinstance(ev_lines, list):
            errors.append(f"'{cid}': evidence_lines must be a list")
        else:
            for ln in ev_lines:
                if not isinstance(ln, int) or isinstance(ln, bool):
                    errors.append(f"'{cid}': evidence_lines must contain integers")
                elif ln < 1 or ln > n_lines:
                    errors.append(f"'{cid}': line {ln} out of range [1, {n_lines}]")
                elif not strip_line_number(answer_lines[ln - 1]).strip():
                    errors.append(f"'{cid}': cited evidence line {ln} is blank")

        if isinstance(awarded, (int, float)) and awarded < max_m and not ev_lines and comment:
            if not has_absence_marker(comment):
                errors.append(f"'{cid}': deduction made without evidence_lines, but comment lacks absence explanation")

    missing = rubric_ids - output_ids
    if missing: errors.append(f"Missing criteria: {sorted(missing)}")
    if isinstance(execution_report, dict) and execution_report.get("compile_ok") is False:
        for c in data["criteria"]:
            if isinstance(c, dict) and any(t in str(c.get("id","")).lower() for t in ("comp", "syntax", "compile")):
                if c.get("awarded") == rubric_map.get(str(c.get("id","")), {}).get("max_marks"):
                    errors.append(f"'{c.get('id')}': full marks awarded despite compile failure")
    return len(errors) == 0, errors

# Bind to builtins so all notebook cells have guaranteed access
builtins.validate_grading_output = validate_grading_output


def postprocess_grading(raw_json: str, rubric: list,
                        student_answer: str, execution_report: Optional[dict]) -> dict:
    """
    Deterministic verifier:
    1. Extract JSON from markdown fences or bare text.
    2. Validate schema.
    3. Clamp/snap awarded marks.
    4. Verify evidence_lines are integers within range.
    5. Sum total in code (never trust model arithmetic).
    6. Execution cross-checks â†’ needs_human_review flags.
    7. Drop hallucinated criterion IDs.
    """
    result = {
        "raw_output":          raw_json,
        "parsed":              None,
        "schema_valid_raw":    False,
        "schema_valid_final":  False,
        "errors_raw":          [],
        "errors_final":        [],
        "needs_human_review":  False,
    }

    
# Deterministic 3-step parser integration from src.parse
try:
    from src.parse import parse_and_validate_output as _parse_v2
except Exception:
    _parse_v2 = None

    # Parse with strict deterministic parser if available
    reasoning_text = ""
    feedback_text = ""
    if _parse_v2 is not None:
        p_res = _parse_v2(raw_json, rubric, student_answer)
        reasoning_text = p_res.reasoning
        feedback_text = p_res.feedback
        result["reasoning"] = reasoning_text
        result["feedback"] = feedback_text
        result["failure_types"] = p_res.failure_types
        if p_res.is_valid:
            result["schema_valid_raw"] = True
            result["schema_valid_final"] = True
            result["parsed"] = {
                "criteria": p_res.criteria,
                "total": p_res.total_marks,
                "needs_human_review": p_res.needs_human_review,
            }
            result["needs_human_review"] = p_res.needs_human_review
            return result

    # Fallback extraction
    clean = raw_json.strip()
    if "```json" in clean:
        clean = clean.split("```json")[-1].split("```")[0].strip()
    elif "```" in clean:
        parts = clean.split("```")
        clean = parts[1].strip() if len(parts) > 1 else clean
    m = re.search(r'\{.*\}', clean, re.DOTALL)
    if m:
        clean = m.group()

    # RAW parse + validate
    try:
        raw_parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        result["errors_raw"]   = [f"JSON parse error: {e}"]
        result["errors_final"] = [f"JSON parse error: {e}"]
        result["needs_human_review"] = True
        return result

    result["raw_parsed"] = raw_parsed
    ok_raw, errs_raw = validate_grading_output(
        json.dumps(raw_parsed), rubric, student_answer
    )
    result["schema_valid_raw"] = ok_raw
    result["errors_raw"]       = errs_raw

    # VERIFIER repairs
    rubric_map   = {c["id"]: c for c in rubric}
    rubric_ids   = set(rubric_map)
    rubric_order = [c["id"] for c in rubric]
    n_lines      = len(student_answer.split("\n"))

    aligned  = []
    seen_ids = set()
    hr       = False

    for crit in raw_parsed.get("criteria", []):
        if not isinstance(crit, dict):
            continue
        cid = crit.get("id")

        if cid not in rubric_ids:
            result["errors_final"].append(f"Hallucinated id '{cid}' dropped.")
            hr = True
            continue
        if cid in seen_ids:
            continue
        seen_ids.add(cid)

        max_m   = float(rubric_map[cid]["max_marks"])
        awarded = crit.get("awarded", 0.0)
        if not isinstance(awarded, (int, float)):
            awarded = 0.0
            hr = True

        # Snap to 0.5 increments; DO NOT clamp -- log out-of-range (Round 3 Rule 0.1)
        awarded = round(float(awarded) * 2) / 2.0
        if awarded < 0 or awarded > max_m:
            errors.append(f"'{cid}': awarded {awarded} out of range [0, {max_m}] -- not clamped")
            result['out_of_range_count'] = result.get('out_of_range_count', 0) + 1
            hr = True
        # Keep awarded as-is (unclamped)

        # Validate evidence_lines
        ev_raw   = crit.get("evidence_lines", [])
        ev_clean = []
        if isinstance(ev_raw, list):
            for ln in ev_raw:
                if isinstance(ln, int) and 1 <= ln <= n_lines:
                    ev_clean.append(ln)
                else:
                    result["errors_final"].append(
                        f"'{cid}': evidence line {ln!r} out of range [1,{n_lines}] â€” removed."
                    )
                    hr = True
        else:
            hr = True

        comment = str(crit.get("comment", "")).strip()[:200]
        aligned.append({
            "id":             cid,
            "awarded":        awarded,
            "comment":        comment,
            "evidence_lines": ev_clean,
        })

    # Fill missing criteria
    for cid in rubric_ids:
        if cid not in seen_ids:
            result["errors_final"].append(f"Missing criterion '{cid}'; assigned 0.")
            hr = True
            aligned.append({"id": cid, "awarded": 0.0,
                            "comment": "Criterion omitted; human review required.",
                            "evidence_lines": []})

    aligned.sort(key=lambda c: rubric_order.index(c["id"])
                 if c["id"] in rubric_order else 999)

    total = round(sum(c["awarded"] for c in aligned) * 2) / 2.0

    # EXECUTION CROSS-CHECKS
    rep = execution_report or {}
    if rep.get("compile_ok") is not None:
        syn_crits = [c for c in aligned if "syntax" in c["id"] or "comp" in c["id"]]
        for sc in syn_crits:
            sc_max = float(rubric_map[sc["id"]]["max_marks"])
            if not rep.get("compile_ok") and sc["awarded"] >= sc_max:
                result["errors_final"].append(
                    f"Cross-check: compile failed but '{sc['id']}' has full marks."
                )
                hr = True

        if rep.get("tests_passed", 0) == rep.get("tests_total", 0) and rep.get("tests_total", 0) > 0:
            for c in aligned:
                if c["awarded"] == 0.0 and "syntax" not in c["id"] and "comp" not in c["id"]:
                    result["errors_final"].append(
                        f"Cross-check: all tests pass but '{c['id']}' awarded 0."
                    )
                    hr = True
                    break

        has_timeout = any("timeout" in str(e) for e in rep.get("runtime_errors", []))
        loop_crits  = [c for c in aligned if "loop" in c["id"]]
        for lc in loop_crits:
            lc_max = float(rubric_map[lc["id"]]["max_marks"])
            if has_timeout and lc["awarded"] >= lc_max:
                result["errors_final"].append(
                    f"Cross-check: timeout detected but '{lc['id']}' has full marks."
                )
                hr = True

    parsed = {
        "criteria":           aligned,
        "total":              total,
        "needs_human_review": hr,
    }
    result["parsed"]              = parsed
    result["needs_human_review"]  = hr

    ok_final, errs_final = validate_grading_output(
        json.dumps({"criteria": aligned, "needs_human_review": hr}),
        rubric, student_answer
    )
    result["schema_valid_final"] = ok_final
    result["errors_final"].extend(errs_final)
    if not ok_final:
        result["needs_human_review"] = True

    return result