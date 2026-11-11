"""Self-contained Python unit tests runnable on Kaggle and locally (Requirement 1).

Must pass before any data generation or training run.
Halts with AssertionError / exit code 1 on any failure.
"""
import json
import os
import sys
import unittest

# Ensure src is importable
_TEST_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_TEST_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from src.schema import SCHEMA_VERSION, validate_grading_output
from src.parse import extract_reasoning_and_json, parse_and_validate_output
from src.prompts import SYSTEM_PROMPT, build_grading_messages, build_gold_output


class TestGraderPipeline(unittest.TestCase):

    def setUp(self):
        self.rubric = [
            {"id": "c1", "description": "Loop construct", "max_marks": 4.0},
            {"id": "c2", "description": "Output format", "max_marks": 3.0}
        ]
        self.student_code_lineno = "1| int main() {\n2|   for(int i=0; i<10; i++) cout << i;\n3| }"

    def test_01_last_balanced_json_extraction(self):
        """Extracts the LAST balanced JSON block containing 'criteria'."""
        sample = (
            "Let's think step-by-step.\n"
            "Earlier reference: {\"dummy\": 123}.\n"
            "Now grading:\n"
            "{\"criteria\": [{\"id\": \"c1\", \"marks_awarded\": 4.0, \"justification\": \"Correct loop construct\", \"evidence_lines\": [2]}, "
            "{\"id\": \"c2\", \"marks_awarded\": 3.0, \"justification\": \"Correct output format\", \"evidence_lines\": [2]}], "
            "\"needs_human_review\": false}\n"
            "Feedback:\nGood job!"
        )
        reasoning, json_str, feedback = extract_reasoning_and_json(sample)
        self.assertTrue(reasoning.startswith("Let's think step-by-step."))
        self.assertTrue(reasoning.endswith("Now grading:"))
        self.assertIn('"criteria"', json_str)
        self.assertNotIn("dummy", json_str)
        self.assertTrue(feedback.startswith("Feedback:"))

    def test_02_no_clamping_and_out_of_range_handling(self):
        """Out-of-range marks must invalidate output and increment out_of_range_count without clamping."""
        bad_json = (
            "Let's think step-by-step.\n"
            "{\"criteria\": [{\"id\": \"c1\", \"marks_awarded\": 5.5, \"justification\": \"Loop logic exceeded\", \"evidence_lines\": [2]}, "
            "{\"id\": \"c2\", \"marks_awarded\": 3.0, \"justification\": \"Output formatting correct\", \"evidence_lines\": [2]}], "
            "\"needs_human_review\": false}"
        )
        res = parse_and_validate_output(bad_json, self.rubric, self.student_code_lineno)
        self.assertFalse(res.is_valid, "Output with 5.5 / 4.0 must be invalid")
        self.assertEqual(res.failure_reason, "out_of_range_marks")
        self.assertGreater(res.out_of_range_count, 0)

    def test_03_dual_field_support(self):
        """Supports both marks_awarded/awarded and justification/comment."""
        valid_completion = (
            "Let's think step-by-step.\n"
            "{\"criteria\": [{\"id\": \"c1\", \"marks_awarded\": 4.0, \"justification\": \"Loop construct valid\", \"evidence_lines\": [2]}, "
            "{\"id\": \"c2\", \"awarded\": 3.0, \"comment\": \"Output format valid\", \"evidence_lines\": [2]}], "
            "\"needs_human_review\": false}"
        )
        res = parse_and_validate_output(valid_completion, self.rubric, self.student_code_lineno)
        self.assertTrue(res.is_valid, f"Dual field format failed: {res.errors}")
        self.assertEqual(res.total_marks, 7.0)
        self.assertEqual(res.parsed["criteria"][0]["marks_awarded"], 4.0)
        self.assertEqual(res.parsed["criteria"][0]["awarded"], 4.0)

    def test_04_pure_logic_zero_compilation_gate(self):
        """Compilation failure must NEVER penalize logical criteria."""
        valid_completion = (
            "{\"criteria\": [{\"id\": \"c1\", \"marks_awarded\": 4.0, \"justification\": \"Logic is sound despite missing header\", \"evidence_lines\": [2]}, "
            "{\"id\": \"c2\", \"marks_awarded\": 3.0, \"justification\": \"Output logic satisfied\", \"evidence_lines\": [2]}], "
            "\"needs_human_review\": false}"
        )
        broken_exec = {
            "compile_ok": False,
            "compile_error": "missing semicolon",
            "compile_lines": [2]
        }
        is_ok, errs = validate_grading_output(valid_completion, self.rubric, self.student_code_lineno, execution_report=broken_exec)
        self.assertTrue(is_ok, f"Logic criteria incorrectly penalized for compilation failure: {errs}")

    def test_05_external_python_total_sum(self):
        """Total marks must be computed by code outside LLM and rounded to 0.5 increments."""
        valid_completion = (
            "{\"criteria\": [{\"id\": \"c1\", \"marks_awarded\": 3.5, \"justification\": \"Partial loop implementation\", \"evidence_lines\": [2]}, "
            "{\"id\": \"c2\", \"marks_awarded\": 2.0, \"justification\": \"Partial output display\", \"evidence_lines\": [2]}], "
            "\"needs_human_review\": false}"
        )
        res = parse_and_validate_output(valid_completion, self.rubric, self.student_code_lineno)
        self.assertTrue(res.is_valid)
        self.assertEqual(res.total_marks, 5.5)

    def test_06_absence_marker_requirement(self):
        """Deductions made without evidence lines must contain an absence explanation."""
        bad_deduction = (
            "{\"criteria\": [{\"id\": \"c1\", \"marks_awarded\": 2.0, \"justification\": \"Incorrect loop execution\", \"evidence_lines\": []}, "
            "{\"id\": \"c2\", \"marks_awarded\": 3.0, \"justification\": \"Valid display output\", \"evidence_lines\": [2]}], "
            "\"needs_human_review\": false}"
        )
        is_ok, errs = validate_grading_output(bad_deduction, self.rubric, self.student_code_lineno)
        self.assertFalse(is_ok, "Evidence-free deduction without absence marker must fail")


def run_unit_tests() -> bool:
    """Run all tests programmatically and return True if all passed."""
    suite = unittest.TestLoader().loadTestsFromTestCase(TestGraderPipeline)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_unit_tests()
    if not success:
        print("[FAIL] Unit tests failed! Halting pipeline execution.")
        sys.exit(1)
    print("[PASS] All Python unit tests passed successfully.")
