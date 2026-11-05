#!/usr/bin/env python3
"""Standalone C++ Quiz Auto-Grader CLI.

Standard University Grading Entrypoint:
Takes:
  --excel: Path to student submissions Excel file (.xlsx) with columns: Roll No, Solution, [GT]
  --question: Path to question.txt
  --rubric: Path to rubric.txt
  --adapter: Path to fine-tuned LoRA adapter directory
  --output: Path to output Excel file (default: Graded_Quiz.xlsx)

Outputs:
  Clean Excel spreadsheet and CSV with Roll No, Criteria marks breakdown, Total score, Feedback, and Review flags.
"""
import os
import sys
import argparse
import json
import logging
import torch

# Ensure package root is in sys.path
_PKG_DIR = os.path.dirname(os.path.abspath(__file__))
if _PKG_DIR not in sys.path:
    sys.path.insert(0, _PKG_DIR)

from src.schema import SCHEMA_VERSION
from src.prompts import SYSTEM_PROMPT, build_grading_messages, add_line_numbers
from src.parse import parse_and_validate_output
from src.quiz_grader import parse_rubric_file, read_excel_submissions, export_graded_excel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("grade_quiz")


def main():
    parser = argparse.ArgumentParser(description="Grade C++ Quiz from Question, Rubric, and Excel files.")
    parser.add_argument("--excel", required=True, help="Path to student submissions Excel file (.xlsx)")
    parser.add_argument("--question", required=True, help="Path to question.txt file")
    parser.add_argument("--rubric", required=True, help="Path to rubric.txt file")
    parser.add_argument("--adapter", default=os.environ.get("ADAPTER_PATH", ""), help="Path to fine-tuned adapter directory")
    parser.add_argument("--base-model", default="Qwen/Qwen3-4B", help="Base model identifier")
    parser.add_argument("--output", default="Graded_Quiz.xlsx", help="Output path for graded Excel file")
    parser.add_argument("--batch-size", type=int, default=4, help="Inference batch size")
    parser.add_argument("--max-new-tokens", type=int, default=768, help="Maximum generated tokens per submission")
    args = parser.parse_args()

    # 1. Read Question Text
    if not os.path.isfile(args.question):
        logger.error(f"Question file not found: {args.question}")
        sys.exit(1)
    with open(args.question, "r", encoding="utf-8") as f:
        question_text = f.read().strip()
    logger.info(f"Loaded question ({len(question_text)} chars) from {args.question}")

    # 2. Read Rubric
    if not os.path.isfile(args.rubric):
        logger.error(f"Rubric file not found: {args.rubric}")
        sys.exit(1)
    with open(args.rubric, "r", encoding="utf-8") as f:
        rubric_text = f.read().strip()
    rubric = parse_rubric_file(rubric_text)
    total_max = sum(c["max_marks"] for c in rubric)
    logger.info(f"Parsed {len(rubric)} rubric criteria (Total Max = {total_max}) from {args.rubric}")
    for c in rubric:
        logger.info(f"  - [{c['id']}] {c['description']} (Max: {c['max_marks']})")

    # 3. Read Excel Submissions
    if not os.path.isfile(args.excel):
        logger.error(f"Excel file not found: {args.excel}")
        sys.exit(1)
    submissions = read_excel_submissions(args.excel)
    if not submissions:
        logger.error(f"No student submissions found in {args.excel}")
        sys.exit(1)
    logger.info(f"Loaded {len(submissions)} student submissions from {args.excel}")

    # 4. Load Model & Tokenizer
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from peft import PeftModel

    logger.info(f"Loading base model: {args.base_model}...")
    bnb_cfg = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token_id = tokenizer.eos_token_id

    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=bnb_cfg,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        trust_remote_code=True
    )

    if args.adapter and os.path.isdir(args.adapter):
        logger.info(f"Loading LoRA adapter from: {args.adapter}...")
        model = PeftModel.from_pretrained(model, args.adapter)
    else:
        logger.warning("No adapter specified; running in zero-shot base model mode.")

    if hasattr(model.config, "enable_thinking"):
        model.config.enable_thinking = False
    model.eval()

    # 5. Grading Loop
    logger.info("Starting Complete Rubric Evaluation (CRE) on student submissions...")
    results = []

    for idx, sub in enumerate(submissions, 1):
        roll = sub["roll_no"] or f"student_{idx}"
        code = sub["student_code"]
        gt = sub.get("teacher_total", 0.0)

        numbered_code = add_line_numbers(code)
        msgs = build_grading_messages(
            question_text=question_text,
            rubric=rubric,
            student_answer_lineno=numbered_code,
            execution_report=None
        )

        try:
            prompt_str = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        except TypeError:
            prompt_str = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)

        inputs = tokenizer(prompt_str, return_tensors="pt").to(model.device)

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=args.max_new_tokens,
                do_sample=False,
                temperature=0.0,
                pad_token_id=tokenizer.pad_token_id
            )
            gen_text = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()

        parse_res: ParseResult = parse_and_validate_output(
            raw_output=gen_text,
            rubric=rubric,
            student_answer_lineno=numbered_code,
            execution_report=None
        )

        record_entry = {
            "roll_no": roll,
            "student_answer_raw": code,
            "gold_total": gt,
            "parsed": {
                "total_marks": parse_res.total_marks,
                "criteria": parse_res.criteria,
                "feedback": parse_res.feedback,
                "reasoning": parse_res.reasoning,
                "needs_human_review": parse_res.needs_human_review,
                "is_valid": parse_res.is_valid
            }
        }
        results.append(record_entry)

        logger.info(f"[{idx}/{len(submissions)}] {roll}: Awarded {parse_res.total_marks}/{total_max} (Valid: {parse_res.is_valid})")

    # 6. Export Results to Excel
    out_file = export_graded_excel(results, rubric, args.output)
    logger.info(f"\n==========================================")
    logger.info(f"Grading Complete! Results saved to:")
    logger.info(f"  {out_file}")
    logger.info(f"==========================================")


if __name__ == "__main__":
    main()
