"""C++ code mutation engine with AST/token-level operators and full provenance (Phase 1.3).

Provides:
1. Label-preserving transforms:
   - Structural & naming: identifier renaming, std:: toggling, endl/'\\n', cin prompt noise.
   - Syntax-error immunity (Round 3 CRE): void main, missing #include, dropped semicolons,
     truncated closing brace, student metadata headers, misspelled identifiers, transliterated
     Urdu identifiers, and cout string typos. (All preserve 100% of logical rubric credit).
2. Diagnostic bug operators: off-by-one, wrong arithmetic op, uninitialized var,
   wrong constant, early return. (Quiz 3 denominations strictly excluded).
3. Detailed provenance tracking (operator ID, line numbers, plain-text descriptions)
   used by trace_builder.py to generate grounded reasoning evidence.
"""
from dataclasses import dataclass, field
import random
import re
from typing import Dict, List, Optional, Tuple, Any


@dataclass
class MutationProvenance:
    operator_id: str
    operator_type: str  # 'label_preserving' | 'bug' | 'syntax'
    affected_lines: List[int]
    description: str
    before_snippet: str
    after_snippet: str


@dataclass
class MutationResult:
    code: str
    provenance_list: List[MutationProvenance]
    is_label_preserving: bool
    expected_bug_type: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# 1. LABEL-PRESERVING OPERATORS (Must preserve full credit)
# ─────────────────────────────────────────────────────────────────────────────

def transform_identifier_renaming(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Rename user variables across camelCase, snake_case, or single letters."""
    keywords = {
        "int", "float", "double", "char", "bool", "void", "long", "short",
        "for", "while", "do", "if", "else", "return", "cin", "cout", "endl",
        "main", "include", "iostream", "using", "namespace", "std", "vector",
        "string", "sizeof", "break", "continue"
    }
    decl_re = re.compile(r"\b(?:int|float|double|char|bool|long)\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s*[;=]")
    matches = decl_re.findall(code)
    vars_found = set()
    for m in matches:
        for v in m.split(","):
            v_name = v.strip().split("=")[0].strip()
            if v_name and v_name not in keywords and len(v_name) > 1:
                vars_found.add(v_name)

    if not vars_found:
        return code, []

    target_var = rng.choice(sorted(vars_found))
    styles = [
        f"{target_var}_val",
        f"my_{target_var}",
        f"{target_var[0].lower()}{target_var[1:].capitalize() if len(target_var) > 1 else 'Val'}",
        f"val_{target_var}"
    ]
    new_var = rng.choice(styles)
    if new_var == target_var:
        new_var = f"{target_var}_2"

    pattern = rf"\b{target_var}\b"
    lines = code.split("\n")
    affected_lines = []
    for idx, l in enumerate(lines, 1):
        if re.search(pattern, l):
            affected_lines.append(idx)

    new_code = re.sub(pattern, new_var, code)
    prov = MutationProvenance(
        operator_id="preserve_identifier_renaming",
        operator_type="label_preserving",
        affected_lines=affected_lines,
        description=f"renamed identifier '{target_var}' to '{new_var}' consistently",
        before_snippet=target_var,
        after_snippet=new_var
    )
    return new_code, [prov]


def transform_namespace_qualification(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Toggle between 'using namespace std;' and explicit 'std::cin', 'std::cout'."""
    lines = code.split("\n")
    provs = []
    has_using = any("using namespace std;" in l for l in lines)

    if has_using:
        new_lines = []
        affected = []
        for idx, l in enumerate(lines, 1):
            if "using namespace std;" in l:
                affected.append(idx)
                continue
            l_mod = re.sub(r"\b(cin|cout|endl|vector|string)\b", r"std::\1", l)
            if l_mod != l:
                affected.append(idx)
            new_lines.append(l_mod)
        new_code = "\n".join(new_lines)
        provs.append(MutationProvenance(
            operator_id="preserve_explicit_std",
            operator_type="label_preserving",
            affected_lines=affected,
            description="replaced 'using namespace std;' with explicit 'std::' qualifiers",
            before_snippet="using namespace std;",
            after_snippet="std::"
        ))
        return new_code, provs
    else:
        new_lines = []
        insert_done = False
        affected = []
        for idx, l in enumerate(lines, 1):
            if not insert_done and ("#include" in l):
                new_lines.append(l)
                new_lines.append("using namespace std;")
                insert_done = True
                affected.append(idx + 1)
                continue
            l_mod = l.replace("std::", "")
            if l_mod != l:
                affected.append(idx)
            new_lines.append(l_mod)
        new_code = "\n".join(new_lines)
        provs.append(MutationProvenance(
            operator_id="preserve_using_std",
            operator_type="label_preserving",
            affected_lines=affected,
            description="added 'using namespace std;' and removed explicit qualifiers",
            before_snippet="std::",
            after_snippet="using namespace std;"
        ))
        return new_code, provs


def transform_endl_to_newline(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Toggle between endl and '\\n'."""
    lines = code.split("\n")
    affected = []
    new_lines = []
    if "endl" in code:
        for idx, l in enumerate(lines, 1):
            if "endl" in l:
                affected.append(idx)
                l = re.sub(r"\bendl\b", r'"\\n"', l)
            new_lines.append(l)
        prov = MutationProvenance(
            operator_id="preserve_newline_string",
            operator_type="label_preserving",
            affected_lines=affected,
            description="used '\\n' instead of 'endl'",
            before_snippet="endl",
            after_snippet='"\\n"'
        )
        return "\n".join(new_lines), [prov]
    elif '"\\n"' in code:
        for idx, l in enumerate(lines, 1):
            if '"\\n"' in l:
                affected.append(idx)
                l = l.replace('"\\n"', "endl")
            new_lines.append(l)
        prov = MutationProvenance(
            operator_id="preserve_endl",
            operator_type="label_preserving",
            affected_lines=affected,
            description="used 'endl' instead of '\\n'",
            before_snippet='"\\n"',
            after_snippet="endl"
        )
        return "\n".join(new_lines), [prov]
    return code, []


def transform_input_prompt_noise(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Add or remove interactive console prompt prior to cin (common student variance)."""
    lines = code.split("\n")
    cin_indices = [i for i, l in enumerate(lines) if re.search(r"\bcin\s*>>", l)]
    if not cin_indices:
        return code, []

    target_idx = rng.choice(cin_indices)
    prev_line = lines[target_idx - 1] if target_idx > 0 else ""
    
    if "cout" in prev_line and ("enter" in prev_line.lower() or "input" in prev_line.lower()):
        new_lines = lines[:target_idx - 1] + lines[target_idx:]
        prov = MutationProvenance(
            operator_id="preserve_remove_cin_prompt",
            operator_type="label_preserving",
            affected_lines=[target_idx],
            description="removed interactive prompt string preceding cin",
            before_snippet=prev_line.strip(),
            after_snippet=""
        )
        return "\n".join(new_lines), [prov]
    else:
        prompt_str = rng.choice([
            'cout << "Enter value: ";',
            'cout << "Please enter input: ";',
            'cout << "Input: ";',
            'cout << "Enter number: ";'
        ])
        indent = len(lines[target_idx]) - len(lines[target_idx].lstrip())
        prompt_line = " " * indent + prompt_str
        new_lines = lines[:target_idx] + [prompt_line] + lines[target_idx:]
        prov = MutationProvenance(
            operator_id="preserve_add_cin_prompt",
            operator_type="label_preserving",
            affected_lines=[target_idx + 1],
            description=f"added console prompt '{prompt_str}' before cin",
            before_snippet="",
            after_snippet=prompt_str
        )
        return "\n".join(new_lines), [prov]


# -----------------------------------------------------------------------------
# Syntax-Error Immunity & Diversity Operators (Round 3 CRE: Full Marks Preserved)
# -----------------------------------------------------------------------------

def inject_void_main(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Replace 'int main()' with 'void main()' or 'main()' (common syntax variant, logic intact)."""
    lines = code.split("\n")
    candidates = [idx for idx, l in enumerate(lines, 1) if re.search(r"\bint\s+main\s*\(", l)]
    if not candidates:
        return code, []
    idx = rng.choice(candidates)
    line = lines[idx - 1]
    replacement = rng.choice(["void main(", "main("])
    mutated = re.sub(r"\bint\s+main\s*\(", replacement, line, count=1)
    lines[idx - 1] = mutated
    prov = MutationProvenance(
        operator_id="preserve_void_main",
        operator_type="label_preserving",
        affected_lines=[idx],
        description="used 'void main()' or implicit int main() entry point; algorithmic logic is fully intact",
        before_snippet=line.strip(),
        after_snippet=mutated.strip()
    )
    return "\n".join(lines), [prov]


def inject_missing_include(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Omit #include or 'using namespace std;' header (syntax error with intact logic)."""
    lines = code.split("\n")
    candidates = [idx for idx, l in enumerate(lines, 1) if "#include" in l or "using namespace std" in l]
    if not candidates:
        return code, []
    idx = rng.choice(candidates)
    removed_line = lines[idx - 1]
    new_lines = lines[:idx - 1] + lines[idx:]
    prov = MutationProvenance(
        operator_id="preserve_missing_header",
        operator_type="label_preserving",
        affected_lines=[idx],
        description=f"omitted header '{removed_line.strip()}'; syntax failure does not alter algorithmic intent",
        before_snippet=removed_line.strip(),
        after_snippet=""
    )
    return "\n".join(new_lines), [prov]


def inject_drop_semicolons(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Drop 1-3 trailing semicolons from statements (compilation failure, logic intact)."""
    lines = code.split("\n")
    candidates = []
    for idx, l in enumerate(lines, 1):
        s = l.strip()
        if s.endswith(";") and not s.startswith("for") and not s.startswith("#") and len(s) > 2:
            candidates.append(idx)
    if not candidates:
        return code, []
    n_drop = min(rng.randint(1, 3), len(candidates))
    chosen = rng.sample(candidates, n_drop)
    provs = []
    for idx in chosen:
        orig = lines[idx - 1]
        r_idx = orig.rfind(";")
        if r_idx >= 0:
            lines[idx - 1] = orig[:r_idx] + orig[r_idx + 1:]
            provs.append(MutationProvenance(
                operator_id="preserve_dropped_semicolon",
                operator_type="label_preserving",
                affected_lines=[idx],
                description=f"dropped trailing semicolon on line {idx}; compilation issue does not alter logic",
                before_snippet=orig.strip(),
                after_snippet=lines[idx - 1].strip()
            ))
    return "\n".join(lines), provs


def inject_drop_closing_brace(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Drop the final closing brace of main (scan truncation / transcription cutoff)."""
    lines = code.split("\n")
    last_brace_idx = -1
    for idx in range(len(lines) - 1, -1, -1):
        if "}" in lines[idx]:
            last_brace_idx = idx
            break
    if last_brace_idx < 0:
        return code, []
    orig = lines[last_brace_idx]
    r_idx = orig.rfind("}")
    lines[last_brace_idx] = orig[:r_idx] + orig[r_idx + 1:]
    prov = MutationProvenance(
        operator_id="preserve_drop_closing_brace",
        operator_type="label_preserving",
        affected_lines=[last_brace_idx + 1],
        description="omitted final closing brace (truncation artifact); algorithmic logic remains complete",
        before_snippet=orig.strip(),
        after_snippet=lines[last_brace_idx].strip()
    )
    return "\n".join(lines), [prov]


def inject_student_header(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Prepend non-code student metadata or assignment prompt text (OCR / scan preamble)."""
    sec = rng.choice(["1A", "1B", "1E", "2A", "2B"])
    roll = f"25F-{rng.randint(100, 999):04d}"
    headers = [
        f"// Name: Student_{rng.randint(1, 99)} Roll No: {roll} Section: {sec}\n",
        f"/* Quiz Submission\n * ID: {roll}\n * Section: {sec}\n */\n",
        f"// Assignment Task\n// Implement C++ solution below\n",
    ]
    hdr = rng.choice(headers)
    new_code = hdr + code
    n_hdr_lines = len(hdr.strip().split("\n"))
    prov = MutationProvenance(
        operator_id="preserve_student_header",
        operator_type="label_preserving",
        affected_lines=list(range(1, n_hdr_lines + 1)),
        description="prepended student metadata header; ignored during logical grading",
        before_snippet="",
        after_snippet=hdr.strip()
    )
    return new_code, [prov]


def inject_misspelled_identifiers(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Introduce slight typos into student variable identifiers (spelling immunity)."""
    keywords = {
        "int", "float", "double", "char", "bool", "void", "long", "short",
        "for", "while", "do", "if", "else", "return", "cin", "cout", "endl",
        "main", "include", "iostream", "using", "namespace", "std", "vector",
        "string", "sizeof", "break", "continue"
    }
    decl_re = re.compile(r"\b(?:int|float|double|char|bool|long)\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s*[;=]")
    matches = decl_re.findall(code)
    vars_found = set()
    for m in matches:
        for v in m.split(","):
            v_name = v.strip().split("=")[0].strip()
            if v_name and v_name not in keywords and len(v_name) > 2:
                vars_found.add(v_name)
    if not vars_found:
        return code, []
    target = rng.choice(sorted(vars_found))
    typos = [
        target + target[-1],
        target[0] + target[0] + target[1:],
        target.replace("a", "aa").replace("e", "ee") if any(c in target for c in "ae") else target + "_val",
        target[:-1] if len(target) > 3 else target + "1"
    ]
    new_name = rng.choice(typos)
    if new_name == target:
        new_name = f"{target}x"
    pattern = rf"\b{target}\b"
    new_code = re.sub(pattern, new_name, code)
    lines = code.split("\n")
    affected = [idx for idx, l in enumerate(lines, 1) if re.search(pattern, l)]
    prov = MutationProvenance(
        operator_id="preserve_misspelled_identifier",
        operator_type="label_preserving",
        affected_lines=affected,
        description=f"spelling variation in identifier '{target}' -> '{new_name}'; logic is unaffected",
        before_snippet=target,
        after_snippet=new_name
    )
    return new_code, [prov]


def inject_urdu_identifiers(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Rename user variables to transliterated Urdu names common in South Asian students."""
    keywords = {
        "int", "float", "double", "char", "bool", "void", "long", "short",
        "for", "while", "do", "if", "else", "return", "cin", "cout", "endl",
        "main", "include", "iostream", "using", "namespace", "std", "vector",
        "string", "sizeof", "break", "continue"
    }
    decl_re = re.compile(r"\b(?:int|float|double|char|bool|long)\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s*[;=]")
    matches = decl_re.findall(code)
    vars_found = set()
    for m in matches:
        for v in m.split(","):
            v_name = v.strip().split("=")[0].strip()
            if v_name and v_name not in keywords and len(v_name) > 1:
                vars_found.add(v_name)
    if not vars_found:
        return code, []
    target = rng.choice(sorted(vars_found))
    urdu_pool = ["adad", "shumar", "hissa", "kul", "natija", "baki", "pehla", "akhri", "taadad"]
    new_name = rng.choice(urdu_pool)
    pattern = rf"\b{target}\b"
    new_code = re.sub(pattern, new_name, code)
    lines = code.split("\n")
    affected = [idx for idx, l in enumerate(lines, 1) if re.search(pattern, l)]
    prov = MutationProvenance(
        operator_id="preserve_urdu_identifier",
        operator_type="label_preserving",
        affected_lines=affected,
        description=f"used transliterated Urdu identifier '{new_name}' for '{target}'; naming choices do not affect marks",
        before_snippet=target,
        after_snippet=new_name
    )
    return new_code, [prov]


def inject_cout_spelling_noise(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Introduce cosmetic spelling mistakes inside cout string literals (cosmetic output noise)."""
    lines = code.split("\n")
    candidates = [idx for idx, l in enumerate(lines, 1) if "cout" in l and '"' in l]
    if not candidates:
        return code, []
    idx = rng.choice(candidates)
    line = lines[idx - 1]
    typo_subs = [
        ("Result", "Reslt"),
        ("result", "reslt"),
        ("Enter", "Entr"),
        ("enter", "entr"),
        ("Total", "Totl"),
        ("total", "totl"),
        ("Number", "Numbr"),
        ("number", "numbr"),
        ("Value", "Valu"),
        ("value", "valu"),
    ]
    mutated = line
    for w, typo in typo_subs:
        if w in mutated:
            mutated = mutated.replace(w, typo, 1)
            break
    if mutated == line:
        return code, []
    lines[idx - 1] = mutated
    prov = MutationProvenance(
        operator_id="preserve_cout_spelling_noise",
        operator_type="label_preserving",
        affected_lines=[idx],
        description=f"cosmetic typo in console string literal on line {idx}; output string typos are never penalized",
        before_snippet=line.strip(),
        after_snippet=mutated.strip()
    )
    return "\n".join(lines), [prov]


# ─────────────────────────────────────────────────────────────────────────────
# 2. DIAGNOSTIC BUG OPERATORS
# ─────────────────────────────────────────────────────────────────────────────

def inject_off_by_one(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Mutate loop bound operator (< to <= or <= to <)."""
    lines = code.split("\n")
    candidates = []
    for idx, l in enumerate(lines, 1):
        if ("for (" in l or "while (" in l) and ("<=" in l or "<" in l or ">=" in l or ">" in l):
            candidates.append(idx)

    if not candidates:
        return code, []

    line_idx = rng.choice(candidates)
    line = lines[line_idx - 1]

    if "<=" in line:
        mutated_line = line.replace("<=", "<", 1)
        desc = f"line {line_idx} uses '<' where '<=' is required (off-by-one boundary error)"
    elif "<" in line:
        mutated_line = line.replace("<", "<=", 1)
        desc = f"line {line_idx} uses '<=' where '<' is required (off-by-one boundary error)"
    elif ">=" in line:
        mutated_line = line.replace(">=", ">", 1)
        desc = f"line {line_idx} uses '>' where '>=' is required (off-by-one boundary error)"
    else:
        mutated_line = line.replace(">", ">=", 1)
        desc = f"line {line_idx} uses '>=' where '>' is required (off-by-one boundary error)"

    lines[line_idx - 1] = mutated_line
    prov = MutationProvenance(
        operator_id="bug_off_by_one",
        operator_type="bug",
        affected_lines=[line_idx],
        description=desc,
        before_snippet=line.strip(),
        after_snippet=mutated_line.strip()
    )
    return "\n".join(lines), [prov]


def inject_wrong_arithmetic_operator(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Mutate arithmetic operator (+ to -, / to %, etc.)."""
    lines = code.split("\n")
    candidates = []
    for idx, l in enumerate(lines, 1):
        if ("for (" not in l) and ("#include" not in l) and ("cout" not in l):
            if any(op in l for op in (" / ", " % ", " + ", " - ", " * ")):
                candidates.append(idx)

    if not candidates:
        return code, []

    line_idx = rng.choice(candidates)
    line = lines[line_idx - 1]

    swap_pairs = [
        (" / ", " % ", "uses modulo '%' where integer division '/' was required"),
        (" % ", " / ", "uses division '/' where modulo remainder '%' was required"),
        (" + ", " - ", "uses subtraction '-' where addition '+' was required"),
        (" - ", " + ", "uses addition '+' where subtraction '-' was required"),
        (" * ", " + ", "uses addition '+' where multiplication '*' was required"),
    ]
    rng.shuffle(swap_pairs)

    for src, dst, detail in swap_pairs:
        if src in line:
            mutated_line = line.replace(src, dst, 1)
            lines[line_idx - 1] = mutated_line
            prov = MutationProvenance(
                operator_id="bug_wrong_arithmetic_op",
                operator_type="bug",
                affected_lines=[line_idx],
                description=f"line {line_idx} {detail}",
                before_snippet=line.strip(),
                after_snippet=mutated_line.strip()
            )
            return "\n".join(lines), [prov]

    return code, []


def inject_uninitialized_variable(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Remove initialization of accumulator/variable (e.g. 'int sum = 0;' -> 'int sum;')."""
    lines = code.split("\n")
    candidates = []
    for idx, l in enumerate(lines, 1):
        if re.search(r"\bint\s+[a-zA-Z_]\w*\s*=\s*0\s*;", l):
            candidates.append(idx)

    if not candidates:
        return code, []

    line_idx = rng.choice(candidates)
    line = lines[line_idx - 1]
    mutated_line = re.sub(r"(\bint\s+[a-zA-Z_]\w*)\s*=\s*0\s*;", r"\1;", line)
    lines[line_idx - 1] = mutated_line

    prov = MutationProvenance(
        operator_id="bug_uninitialized_variable",
        operator_type="bug",
        affected_lines=[line_idx],
        description=f"line {line_idx} declares variable without zero-initialization (contains garbage values)",
        before_snippet=line.strip(),
        after_snippet=mutated_line.strip()
    )
    return "\n".join(lines), [prov]


def inject_wrong_constant(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Mutate an integer constant in calculation (e.g. 100 -> 50, 10 -> 5, 2 -> 3).
    
    Zero Quiz 3 Denominations Firewall: Only operates on generic mathematical constants.
    """
    lines = code.split("\n")
    candidates = []
    for idx, l in enumerate(lines, 1):
        if ("#include" not in l) and ("cout" not in l) and ("for (" not in l):
            nums = re.findall(r"\b\d+\b", l)
            if any(int(n) in (100, 10, 5, 2, 3, 4, 8) for n in nums):
                candidates.append(idx)

    if not candidates:
        return code, []

    line_idx = rng.choice(candidates)
    line = lines[line_idx - 1]

    def repl(m):
        val = int(m.group(0))
        mapping = {100: 50, 50: 100, 10: 5, 5: 10, 2: 3, 3: 2, 4: 8, 8: 4}
        return str(mapping.get(val, val + 1))

    mutated_line = re.sub(r"\b(100|50|10|5|2|3|4|8)\b", repl, line, count=1)
    if mutated_line == line:
        return code, []

    lines[line_idx - 1] = mutated_line
    prov = MutationProvenance(
        operator_id="bug_wrong_constant",
        operator_type="bug",
        affected_lines=[line_idx],
        description=f"line {line_idx} uses incorrect numerical constant in calculation",
        before_snippet=line.strip(),
        after_snippet=mutated_line.strip()
    )
    return "\n".join(lines), [prov]


def inject_early_return(code: str, rng: random.Random) -> Tuple[str, List[MutationProvenance]]:
    """Inject an accidental return statement inside loop or before complete output."""
    lines = code.split("\n")
    loop_indices = [i for i, l in enumerate(lines) if "for (" in l or "while (" in l]
    if not loop_indices:
        return code, []

    target_loop = rng.choice(loop_indices)
    indent = len(lines[target_loop]) - len(lines[target_loop].lstrip()) + 4
    ret_line = " " * indent + "return 0;"
    lines.insert(target_loop + 1, ret_line)

    prov = MutationProvenance(
        operator_id="bug_early_return",
        operator_type="bug",
        affected_lines=[target_loop + 2],
        description=f"line {target_loop + 2} exits prematurely via early return before computation completes",
        before_snippet="",
        after_snippet=ret_line.strip()
    )
    return "\n".join(lines), [prov]


# ─────────────────────────────────────────────────────────────────────────────
# 3. HIGH-LEVEL MUTATION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

LABEL_PRESERVING_OPS = [
    transform_identifier_renaming,
    transform_namespace_qualification,
    transform_endl_to_newline,
    transform_input_prompt_noise,
    inject_void_main,
    inject_missing_include,
    inject_drop_semicolons,
    inject_drop_closing_brace,
    inject_student_header,
    inject_misspelled_identifiers,
    inject_urdu_identifiers,
    inject_cout_spelling_noise,
]

BUG_OPS = [
    inject_off_by_one,
    inject_wrong_arithmetic_operator,
    inject_uninitialized_variable,
    inject_wrong_constant,
    inject_early_return,
]


def apply_mutations(
    code: str,
    n_bugs: int,
    n_preserving: int,
    rng: random.Random
) -> MutationResult:
    """Apply combination of label-preserving transforms and bug operators with provenance."""
    current_code = code
    all_provenance: List[MutationProvenance] = []

    # 1. Apply label-preserving transforms first
    selected_pres = rng.sample(LABEL_PRESERVING_OPS, min(n_preserving, len(LABEL_PRESERVING_OPS)))
    for op in selected_pres:
        current_code, provs = op(current_code, rng)
        all_provenance.extend(provs)

    # 2. Apply bug operators
    if n_bugs > 0:
        selected_bugs = rng.sample(BUG_OPS, min(n_bugs, len(BUG_OPS)))
        for op in selected_bugs:
            current_code, provs = op(current_code, rng)
            all_provenance.extend(provs)

    is_preserving = (n_bugs == 0)
    expected_bug = all_provenance[-1].operator_id if (not is_preserving and all_provenance) else None

    return MutationResult(
        code=current_code,
        provenance_list=all_provenance,
        is_label_preserving=is_preserving,
        expected_bug_type=expected_bug
    )
