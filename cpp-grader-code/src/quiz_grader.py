"""Direct Quiz Grader for Excel Submissions, Question, and Rubric Files.

Standard University Workflow:
- Input 1: question.txt (Assignment / quiz statement)
- Input 2: rubric.txt (Criteria and mark distribution)
- Input 3: Solutions.xlsx (Excel file with columns: Roll No, Solution, optional GT)

Zero OCR or scan noise. Pure digital C++ text evaluated on logical correctness against the rubric.
Exports graded results to a clean Excel spreadsheet (and CSV).
"""
import os
import sys
import re
import json
import zipfile
import logging
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple

from .schema import SCHEMA_VERSION, validate_grading_output
from .prompts import SYSTEM_PROMPT, build_grading_messages, add_line_numbers
from .parse import parse_and_validate_output, ParseResult

logger = logging.getLogger("quiz_grader")


def parse_rubric_file(text: str) -> List[Dict[str, Any]]:
    """Parse rubric.txt file into structured criteria list.
    
    Supports standard formats like:
    1 mark: input amount as integer
    3 marks: calculate no. of notes
    1 mark: display output
    2 marks: correct program flow/logic
    Total = 7
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    criteria = []
    idx = 1
    for line in lines:
        if line.lower().startswith("total"):
            continue
        # Format: "X mark(s): description" or "X: description" or "X marks - description"
        m = re.match(r"^([\d\.]+)\s*(?:marks?|pts?|points?)?\s*[:\-]\s*(.*)$", line, re.IGNORECASE)
        if m:
            marks = float(m.group(1))
            desc = m.group(2).strip()
            criteria.append({"id": f"c{idx}", "description": desc, "max_marks": marks})
            idx += 1
        elif ":" in line:
            parts = line.split(":", 1)
            try:
                num_str = re.sub(r"[^\d\.]", "", parts[0])
                marks = float(num_str)
                desc = parts[1].strip()
                criteria.append({"id": f"c{idx}", "description": desc, "max_marks": marks})
                idx += 1
            except ValueError:
                continue

    if not criteria:
        # Fallback single criterion
        criteria = [{"id": "c1", "description": "Overall logical correctness", "max_marks": 10.0}]

    return criteria


def read_excel_submissions(excel_path: str) -> List[Dict[str, Any]]:
    """Read student code from Excel file with columns: Roll No, Solution, and optional GT.
    
    Attempts pandas first, with pure-Python OpenXML fallback.
    """
    rows = []
    # 1. Try pandas
    try:
        import pandas as pd
        df = pd.read_excel(excel_path)
        for _, r in df.iterrows():
            roll = str(r.get("Roll No") or r.get("RollNo") or r.get("roll") or r.get("Student ID") or "").strip()
            sol = str(r.get("Solution") or r.get("solution") or r.get("Code") or r.get("code") or "").strip()
            gt_val = r.get("GT") if pd.notna(r.get("GT")) else r.get("Marks", r.get("Score", 0.0))
            if sol:
                try:
                    gt = float(gt_val)
                except (ValueError, TypeError):
                    gt = 0.0
                rows.append({"roll_no": roll, "student_code": sol, "teacher_total": gt})
        if rows:
            return rows
    except Exception as e:
        logger.warning(f"pandas read_excel failed ({e}); falling back to OpenXML parser.")

    # 2. Pure-Python OpenXML parser (zero external dependencies)
    with zipfile.ZipFile(excel_path, "r") as z:
        # Load shared strings table if present
        shared_strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            with z.open("xl/sharedStrings.xml") as s_f:
                s_tree = ET.parse(s_f)
                s_root = s_tree.getroot()
                ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                for si in s_root.findall("main:si", ns):
                    t = si.find("main:t", ns)
                    shared_strings.append(t.text if t is not None and t.text else "")

        with z.open("xl/worksheets/sheet1.xml") as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            sheet_data = root.find("main:sheetData", ns)
            if sheet_data is not None:
                for row_el in sheet_data.findall("main:row", ns):
                    if row_el.attrib.get("r") == "1":
                        continue
                    cells = {}
                    for c in row_el.findall("main:c", ns):
                        ref = c.attrib.get("r", "")
                        col = "".join(filter(str.isalpha, ref))
                        c_type = c.attrib.get("t", "")
                        is_node = c.find("main:is", ns)
                        v_node = c.find("main:v", ns)
                        val = ""
                        if is_node is not None:
                            t_node = is_node.find("main:t", ns)
                            if t_node is not None and t_node.text:
                                val = t_node.text
                        elif v_node is not None and v_node.text:
                            raw_val = v_node.text
                            if c_type == "s" and raw_val.isdigit() and int(raw_val) < len(shared_strings):
                                val = shared_strings[int(raw_val)]
                            else:
                                val = raw_val
                        cells[col] = val

                    roll = cells.get("A", "").strip()
                    sol = cells.get("B", "").strip()
                    try:
                        gt = float(cells.get("C", "0").strip())
                    except ValueError:
                        gt = 0.0
                    if sol:
                        rows.append({"roll_no": roll, "student_code": sol, "teacher_total": gt})
    return rows


def export_graded_excel(
    results: List[Dict[str, Any]],
    rubric: List[Dict[str, Any]],
    output_path: str
) -> str:
    """Export graded student submissions into a clean Excel spreadsheet (and CSV)."""
    rows = []
    total_max = sum(c["max_marks"] for c in rubric)

    for r in results:
        parsed = r.get("parsed") or {}
        crit_list = parsed.get("criteria", [])
        crit_map = {c["id"]: c for c in crit_list if isinstance(c, dict)}
        awarded_total = parsed.get("total_marks", 0.0)

        roll = r.get("roll_no") or r.get("sample_id", "").replace("real_q3_", "").replace("real_", "")
        row = {
            "Roll No": roll,
            "Total Score": awarded_total,
            "Max Marks": total_max,
            "Percentage (%)": round((awarded_total / max(total_max, 1.0)) * 100, 1),
            "Needs Review": parsed.get("needs_human_review", False),
            "Feedback": parsed.get("feedback", ""),
        }

        if "gold_total" in r and r["gold_total"] > 0:
            gt = r["gold_total"]
            row["Instructor GT"] = gt
            row["Diff"] = round(abs(awarded_total - gt), 2)
            row["Match Status"] = "Exact" if abs(awarded_total - gt) < 0.01 else ("Close" if abs(awarded_total - gt) <= 0.5 else "Mismatch")

        # Per-criterion breakdown columns
        for c in rubric:
            cid = c["id"]
            desc = c.get("description", cid)
            max_m = c.get("max_marks", 1.0)
            col_name = f"{cid}: {desc} (Max {max_m})"
            c_awarded = crit_map.get(cid, {}).get("awarded", 0.0) if cid in crit_map else 0.0
            row[col_name] = c_awarded

        row["Reasoning (Step 1)"] = parsed.get("reasoning", "")
        row["Student Code"] = r.get("student_answer_raw", "")
        rows.append(row)

    # Save via pandas if available
    saved_path = output_path
    try:
        import pandas as pd
        df = pd.DataFrame(rows)
        if output_path.endswith(".xlsx"):
            df.to_excel(output_path, index=False)
            csv_alt = output_path.replace(".xlsx", ".csv")
            df.to_csv(csv_alt, index=False)
        else:
            df.to_csv(output_path, index=False)
    except Exception as e:
        # CSV fallback
        import csv
        csv_path = output_path.replace(".xlsx", ".csv") if output_path.endswith(".xlsx") else output_path
        if rows:
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
                writer.writeheader()
                writer.writerows(rows)
        saved_path = csv_path

    logger.info(f"Graded results exported to: {saved_path}")
    return saved_path

