"""Ingestion and rubric alignment for real student repositories (Phase 1.6).

Covers:
- IntroClass (ProgramRepair/IntroClass)
- C-Pack-IPAs (pmorvalho/C-Pack-IPAs)
- ITSP (jyi/ITSP)

Extracts introductory student tasks, aligns them with approach-agnostic rubrics
(totalling 10.0 marks), deduplicates by AST hash, and manages held-out tasks
for 'test_unseen_real_tasks'.
"""
from dataclasses import dataclass, field
import glob
import hashlib
import json
import logging
import os
import re
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger("real_sources")


@dataclass
class RealRepoTask:
    task_id: str
    repo_name: str
    topic: str
    statement: str
    rubric: List[Dict[str, Any]]
    test_cases: List[Dict[str, str]]
    reference_code: str
    is_held_out: bool = False


# Canonical task rubrics for repository benchmarks (10 marks total, approach-agnostic)
REAL_TASK_BANK: List[RealRepoTask] = [
    RealRepoTask(
        task_id="introclass_digits",
        repo_name="IntroClass",
        topic="loops_arithmetic",
        statement="Write a C/C++ program that reads an integer and prints its digits in reverse, one per line with a trailing newline.",
        rubric=[
            {"id": "digits_input", "description": "Reads integer input correctly", "max_marks": 2.0},
            {"id": "digits_extraction", "description": "Correctly extracts digits via modulo and division", "max_marks": 4.0},
            {"id": "digits_display", "description": "Outputs each digit on a separate line", "max_marks": 2.0},
            {"id": "digits_flow", "description": "Handles zero and termination properly", "max_marks": 2.0}
        ],
        test_cases=[
            {"in": "372", "out": "2\n7\n3\n"},
            {"in": "100", "out": "0\n0\n1\n"},
            {"in": "5", "out": "5\n"},
            {"in": "0", "out": "0\n"}
        ],
        reference_code="""#include <iostream>
using namespace std;
int main() {
    int n;
    if (cin >> n) {
        if (n == 0) { cout << 0 << endl; return 0; }
        if (n < 0) n = -n;
        while (n > 0) {
            cout << (n % 10) << endl;
            n /= 10;
        }
    }
    return 0;
}""",
        is_held_out=False
    ),
    RealRepoTask(
        task_id="introclass_median",
        repo_name="IntroClass",
        topic="conditionals",
        statement="Write a C/C++ program that reads three integers and outputs the median (middle) value.",
        rubric=[
            {"id": "med_input", "description": "Reads 3 integers from stdin", "max_marks": 2.0},
            {"id": "med_compare", "description": "Compares all 3 values correctly to find middle", "max_marks": 5.0},
            {"id": "med_output", "description": "Outputs the exact median value", "max_marks": 3.0}
        ],
        test_cases=[
            {"in": "3 1 2", "out": "2"},
            {"in": "10 20 30", "out": "20"},
            {"in": "5 5 1", "out": "5"},
            {"in": "4 9 4", "out": "4"}
        ],
        reference_code="""#include <iostream>
using namespace std;
int main() {
    int a, b, c;
    if (cin >> a >> b >> c) {
        if ((a >= b && a <= c) || (a <= b && a >= c)) cout << a << endl;
        else if ((b >= a && b <= c) || (b <= a && b >= c)) cout << b << endl;
        else cout << c << endl;
    }
    return 0;
}""",
        is_held_out=False
    ),
    RealRepoTask(
        task_id="introclass_smallest",
        repo_name="IntroClass",
        topic="conditionals",
        statement="Write a C/C++ program that reads four integers and outputs the smallest value.",
        rubric=[
            {"id": "sml_input", "description": "Reads 4 integers from stdin", "max_marks": 2.0},
            {"id": "sml_logic", "description": "Determines minimum across all 4 integers", "max_marks": 5.0},
            {"id": "sml_output", "description": "Prints smallest value", "max_marks": 3.0}
        ],
        test_cases=[
            {"in": "4 2 8 1", "out": "1"},
            {"in": "-5 -2 -10 0", "out": "-10"},
            {"in": "7 7 7 7", "out": "7"}
        ],
        reference_code="""#include <iostream>
using namespace std;
int main() {
    int a, b, c, d;
    if (cin >> a >> b >> c >> d) {
        int m = a;
        if (b < m) m = b;
        if (c < m) m = c;
        if (d < m) m = d;
        cout << m << endl;
    }
    return 0;
}""",
        is_held_out=False
    ),
    # Held-out real tasks for test_unseen_real_tasks
    RealRepoTask(
        task_id="introclass_checksum",
        repo_name="IntroClass",
        topic="strings_arithmetic",
        statement="Write a C/C++ program that reads a single line of text and computes its 8-bit checksum as the sum of ASCII values modulo 64, offset by character ' ' (space).",
        rubric=[
            {"id": "chk_input", "description": "Reads line of characters or string", "max_marks": 2.0},
            {"id": "chk_sum", "description": "Accumulates ASCII values accurately", "max_marks": 4.0},
            {"id": "chk_modulo", "description": "Applies modulo arithmetic correctly", "max_marks": 2.0},
            {"id": "chk_output", "description": "Prints resulting checksum character", "max_marks": 2.0}
        ],
        test_cases=[
            {"in": "Hello", "out": "T"},
            {"in": "A", "out": "!"}
        ],
        reference_code="""#include <iostream>
#include <string>
using namespace std;
int main() {
    string s;
    if (getline(cin, s)) {
        int sum = 0;
        for (char c : s) sum += (int)c;
        char res = (char)((sum % 64) + ' ');
        cout << res << endl;
    }
    return 0;
}""",
        is_held_out=True  # Held out for test_unseen_real_tasks
    ),
    RealRepoTask(
        task_id="introclass_syllables",
        repo_name="IntroClass",
        topic="strings_loops",
        statement="Write a C/C++ program that reads a string and counts the number of vowels (a, e, i, o, u, y, case-insensitive).",
        rubric=[
            {"id": "syl_input", "description": "Reads input string from stdin", "max_marks": 2.0},
            {"id": "syl_loop", "description": "Iterates through each character", "max_marks": 3.0},
            {"id": "syl_check", "description": "Identifies vowel characters correctly", "max_marks": 3.0},
            {"id": "syl_output", "description": "Prints total vowel count", "max_marks": 2.0}
        ],
        test_cases=[
            {"in": "programming", "out": "3"},
            {"in": "rhythm", "out": "1"},
            {"in": "AEIOU", "out": "5"}
        ],
        reference_code="""#include <iostream>
#include <string>
#include <cctype>
using namespace std;
int main() {
    string s;
    if (cin >> s) {
        int count = 0;
        for (char c : s) {
            char low = tolower(c);
            if (low == 'a' || low == 'e' || low == 'i' || low == 'o' || low == 'u' || low == 'y') count++;
        }
        cout << count << endl;
    }
    return 0;
}""",
        is_held_out=True  # Held out for test_unseen_real_tasks
    )
]


def load_introclass_student_programs(repo_root: str, task_name: str) -> List[Dict[str, Any]]:
    """Inspect and extract student programs from an IntroClass task folder."""
    task_dir = os.path.join(repo_root, task_name)
    if not os.path.isdir(task_dir):
        logger.warning(f"IntroClass task dir {task_dir} not found.")
        return []

    programs = []
    # IntroClass layout: <task>/<user_id>/<version>/<user_id>.c
    c_files = glob.glob(os.path.join(task_dir, "*", "*", "*.c"))
    seen_hashes = set()

    for path in c_files:
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                code = f.read()
            # Normalize for deduplication
            norm_code = re.sub(r"\s+", " ", re.sub(r"//.*|/\*[\s\S]*?\*/", "", code)).strip()
            chash = hashlib.sha256(norm_code.encode("utf-8")).hexdigest()
            if chash in seen_hashes:
                continue
            seen_hashes.add(chash)

            parts = os.path.normpath(path).split(os.sep)
            user_id = parts[-3] if len(parts) >= 3 else "user"
            version = parts[-2] if len(parts) >= 2 else "000"

            programs.append({
                "student_id": f"introclass_{user_id}_{version}",
                "task_id": f"introclass_{task_name}",
                "code": code,
                "origin": "real_repo",
                "repo_name": "IntroClass",
                "language": "c",
                "source_file": path
            })
        except Exception as e:
            logger.debug(f"Failed to read {path}: {e}")

    logger.info(f"Loaded {len(programs)} deduplicated student programs from IntroClass task '{task_name}'")
    return programs

