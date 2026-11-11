"""Grading prompt builder for v2 structured reasoning and direct targets (README §5, Phase 2).

Enforces Pure-Logic Complete Rubric Evaluation (Pathak et al., CRE) and 3-step
structured output (Koutcheme et al., SIGCSE 2026).
The exact same prompt generation logic must be used to build training data (NB1),
teacher distillation (NB1b), train (NB2), evaluate / infer (NB3), and grade Excel quizzes.
"""
import json
from typing import Optional, List, Dict, Any

from .schema import SCHEMA_VERSION

# System prompt enforcing Pure-Logic Complete Rubric Evaluation (CRE)
SYSTEM_PROMPT = """\
You are an expert C++ university instructor grading student quiz submissions using Complete Rubric Evaluation (CRE, schema {schema_version}).
Evaluate the student submission strictly on logical correctness and conceptual understanding against each rubric criterion in order.

CORE GRADING PRINCIPLES
1. PURE LOGICAL RUBRIC EVALUATION: Evaluate each criterion independently based on what the student's algorithmic logic achieves. IGNORE all syntax errors, compilation issues, missing headers, missing semicolons, spelling mistakes in text/identifiers, and variable naming choices. Treat broken syntax as valid syntax and infer the student's underlying C++ algorithmic logic and intention. Non-compiling code must NOT receive penalties on logical criteria.
2. APPROACH AGNOSTIC: Multiple algorithmic approaches (e.g., arithmetic division/modulo, arrays with loops, while-subtraction loops, recursion, helper functions) are equally valid. Award full criterion marks if any valid C++ logic achieves the criterion's objective.
3. OUTPUT FORMAT (Must follow this exact 3-step order):
   Step 1. Chain-of-thought analysis starting with:
   Let's think step-by-step.
   For each criterion in rubric order: state the criterion requirement and max marks, cite evidence line numbers from student code, evaluate the student's algorithmic intent (ignoring syntax quirks), and state the verdict with awarded marks.
   Step 2. A single compact JSON object matching the output schema.
   Step 3. Constructive sandwich feedback (<= 3 sentences) highlighting satisfied criteria first, explaining at most the first two logical mistakes in an encouraging tone, and ending with a supportive closing sentence.

OUTPUT SCHEMA (schema {schema_version})
{{"criteria":[{{"id":"<id>","marks_awarded":<number>,"justification":"<string>","evidence_lines":[<int>,...]}},...],"needs_human_review":false}}

NOTES
- marks_awarded (or awarded) must be in 0.5 increments and in [0, criterion_max].
- total is NOT in the output; it is computed from awarded values by code outside the LLM.
- max is NOT in the output; it comes from the rubric.
- evidence_lines must contain 1-based line numbers where the logic appears or where an issue exists, or [] when the criterion is fully met across the program or logic is absent (explain what is absent in justification/comment).
""".format(schema_version=SCHEMA_VERSION)


def add_line_numbers(code: str) -> str:
    """Number lines as '<n>| <code>', width = digits of the line count."""
    lines = code.split("\n")
    width = len(str(len(lines)))
    return "\n".join(f"{i + 1:{width}}| {line}" for i, line in enumerate(lines))


def build_exec_section(rep: Optional[dict]) -> str:
    """Render the execution report.
    
    Execution reports are purely informational and must never gate or penalize
    logical criteria marks.
    """
    if not isinstance(rep, dict) or not rep or rep.get("available") is False:
        return "Execution report: not available (evaluate purely on static C++ logical intent)"

    info_note = (
        "Note: Execution report is purely informational. Non-compiling code or runtime errors "
        "caused by syntax/typing slips must NOT penalize logical rubric criteria."
    )

    if not rep.get("compile_ok"):
        exec_data = {
            "compile_ok": False,
            "compile_error": (rep.get("compile_error") or "unknown")[:400],
            "compile_lines": rep.get("compile_lines", [])[:10],
            "informational_only": True
        }
        return f"{info_note}\n{json.dumps(exec_data)}"

    results = []
    for tc in rep.get("test_results", [])[:6]:
        results.append({
            "stdin": (tc.get("stdin") or "")[:120],
            "expected": (tc.get("expected") or "")[:120],
            "actual": (tc.get("actual") or "")[:120],
            "passed": tc.get("passed", False),
            "exit_code": tc.get("exit_code"),
            "timeout": tc.get("timeout", False),
        })

    exec_data = {
        "compile_ok": True,
        "tests_passed": rep.get("tests_passed", 0),
        "tests_total": rep.get("tests_total", 0),
        "runtime_errors": [str(e)[:120] for e in rep.get("runtime_errors", [])[:4]],
        "test_results": results,
        "informational_only": True
    }
    return f"{info_note}\n{json.dumps(exec_data)}"


def build_grading_messages(
    question_text: str,
    rubric: List[Dict[str, Any]],
    student_answer_lineno: str,
    execution_report: Optional[dict] = None,
    reference_solution: Optional[str] = None,
    include_reference: bool = False
) -> list:
    """System + user chat messages for one Complete Rubric Evaluation (CRE) request."""
    rub = json.dumps(
        [{"id": c["id"], "description": c["description"], "max_marks": c["max_marks"]}
         for c in rubric],
        indent=2,
    )
    
    sections = [
        f"## Question\n{question_text}",
        f"## Rubric\n{rub}\nNote: Any valid C++ algorithmic approach that achieves the criterion requirements earns full credit. Ignore all syntax errors, typos, and variable names."
    ]

    if include_reference and reference_solution:
        sections.append(f"## Reference Solution (one valid approach among many)\n```cpp\n{reference_solution.strip()}\n```")

    sections.append(f"## Student Answer (with line numbers)\n```\n{student_answer_lineno}\n```")
    sections.append(f"## Execution Report\n{build_exec_section(execution_report)}")
    sections.append("Grade this answer step-by-step according to the instructions, then output the final JSON and constructive feedback.")

    user_msg = "\n\n".join(sections)
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]


def build_gold_output(gold_criteria: list, needs_human_review: bool) -> str:
    """Compact gold JSON target (no total, no max)."""
    return json.dumps(
        {"criteria": gold_criteria, "needs_human_review": needs_human_review},
        ensure_ascii=False, separators=(",", ":"),
    )


def apply_chat_template_safe(
    tokenizer: Any,
    messages: List[Dict[str, str]],
    add_generation_prompt: bool = False,
    tokenize: bool = False
) -> str:
    """Apply chat template while explicitly locking enable_thinking=False for Qwen3 models.
    
    Prevents hidden thinking tokens from colliding with explicit reasoning or truncating outputs.
    """
    try:
        return tokenizer.apply_chat_template(
            messages,
            tokenize=tokenize,
            add_generation_prompt=add_generation_prompt,
            enable_thinking=False
        )
    except TypeError:
        return tokenizer.apply_chat_template(
            messages,
            tokenize=tokenize,
            add_generation_prompt=add_generation_prompt
        )
