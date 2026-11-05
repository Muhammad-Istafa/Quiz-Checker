# SPOTCHECK.md — 20 Static Grader Behaviour Examples

**Status:** `Implemented (logic mirrored, Python not executed)`  
**Rule:** No Quiz 3 denominations (1000, 500, 100, 50, 20, 10, 5, 1). Uses IntroClass tasks (digits, median, smallest) or invented simple tasks.  
**Task used for all examples:** "Write a C++ program that reads a positive integer `n` and prints its digits in reverse order, one per line."  
**Rubric:**
```json
[
  {"id": "d_c1", "description": "Read integer input into a variable", "max_marks": 1},
  {"id": "d_c2", "description": "Extract and output each digit in reverse order (least-significant first) using division/modulo or equivalent logic", "max_marks": 3},
  {"id": "d_c3", "description": "Output each digit on its own line", "max_marks": 1}
]
```
Total marks: 5

---

## Group A — Syntax-Broken Code → SHOULD Receive Full Logical Credit

> [!NOTE]
> These examples demonstrate code that fails `g++` but whose logical intent is fully correct. The grader MUST award 5/5 for each.

---

### A1 — `void main()` + Missing `#include`

```cpp
void main() {
    int n;
    cin >> n;
    while (n > 0) {
        cout << n % 10 << "\n";
        n /= 10;
    }
}
```

**g++ result:** `error: '::main' must return 'int'`; `error: 'cin' was not declared` (missing `#include <iostream>`)  
**Expected grading:**

| Criterion | Max | Awarded | Reasoning |
|-----------|-----|---------|-----------|
| d_c1 | 1 | **1** | Line 3: `cin >> n` reads integer input. Missing `#include` and `void main` are syntax issues — logical intent of reading `n` is clear. |
| d_c2 | 3 | **3** | Lines 4–7: `while (n > 0)` loop with `n % 10` extracts least-significant digit each iteration; `n /= 10` advances. Standard reverse-digit algorithm. |
| d_c3 | 1 | **1** | Line 5: `"\n"` after each digit outputs each on its own line. |
| **Total** | 5 | **5** | |

**Model reasoning must include (Step 1):** "Let's think step-by-step. `void main()` is a syntax issue but the logical entry point is unambiguous. `cin >> n` on line 3 satisfies d_c1..."

---

### A2 — Missing Semicolons (3 dropped) + Abrupt Truncation

```cpp
#include <iostream>
using namespace std;
int main() {
    int num
    cin >> num
    while (num > 0) {
        int d = num % 10
        cout << d << endl
        num /= 10;
    }
}
```

**g++ result:** `error: expected ';'` ×3  
**Expected grading:** 5/5 (d_c1=1, d_c2=3, d_c3=1)  
**Key reasoning:** "Semicolons are absent on lines 4, 5, 7, 8 — these are syntax errors that do not alter the algorithmic logic. `num % 10` on line 7, `num /= 10` on line 9, and `endl` on line 8 together satisfy d_c2 and d_c3 fully."

---

### A3 — Roll Number Header + Prompt Text Preamble (OCR noise)

```
Name: Ali Hamza    Roll No: 25F-0123    Section: 1E
Question: Print digits of n in reverse.

#include<iostream>
using namespace std;
int main(){
    int n;
    cin>>n;
    for(;n;n/=10)
        cout<<n%10<<"\n";
}
```

**g++ result:** `error: 'Name' was not declared in this scope` (non-code header lines)  
**Expected grading:** 5/5  
**Key reasoning:** "Lines 1–2 are a student header / assignment prompt preamble. These are ignored. Code starts at line 4. `cin>>n` on line 8 satisfies d_c1. `for(;n;n/=10)` with `n%10` on lines 9–10 is a compact equivalent of `while(n>0){digit=n%10; n/=10;}` — d_c2 fully satisfied. `"\n"` on line 10 satisfies d_c3."

---

### A4 — Missing Closing Brace (file truncated mid-code)

```cpp
#include <iostream>
using namespace std;
int main() {
    int x;
    cin >> x;
    do {
        cout << x % 10 << "\n";
        x /= 10;
    } while (x > 0);
// file ends here without }
```

**g++ result:** `error: expected '}' at end of input`  
**Expected grading:** 5/5  
**Key reasoning:** "The file is truncated — closing `}` for `main()` is absent. This is a transcription/scan artifact. The `do-while` loop on lines 6–9 is semantically equivalent to a `while` loop for positive input: extracts `x%10`, outputs it on its own line, then divides. All three criteria satisfied."

---

### A5 — `main()` with No Return Type + Using `printf`

```cpp
#include <stdio.h>
main() {
    int n;
    scanf("%d", &n);
    while (n > 0) {
        printf("%d\n", n % 10);
        n /= 10;
    }
}
```

**g++ result (C++ mode):** Warning: implicit int return; `main()` without return type is C89 — may compile with warnings or error depending on flags  
**Expected grading:** 5/5  
**Key reasoning:** "`scanf`/`printf` are C-style I/O but achieve identical input/output semantics. `scanf(\"%d\", &n)` satisfies d_c1. The while loop with `n%10` satisfies d_c2. `\"%d\\n\"` format in `printf` satisfies d_c3."

---

## Group B — Alternative Algorithmic Approaches → SHOULD Receive Full Credit

> [!NOTE]
> These examples use structurally different algorithms. The grader MUST award 5/5 for each — multiple valid approaches earn full marks.

---

### B1 — Array Accumulation Then Print (Paradigm B)

```cpp
#include <iostream>
using namespace std;
int main() {
    int n, digits[20], count = 0;
    cin >> n;
    while (n > 0) {
        digits[count++] = n % 10;
        n /= 10;
    }
    for (int i = 0; i < count; i++)
        cout << digits[i] << "\n";
}
```

**Expected grading:** 5/5  
**Key reasoning:** "Stores digits in array first (lines 7–9), then prints in order (lines 10–11). The first element of the array IS the least-significant digit (n%10), so this outputs digits in reverse order. Equivalent to direct-print approach. d_c2: satisfied via array accumulation. d_c3: each `digits[i]` on its own line via `\"\n\"`."

---

### B2 — Recursive Helper Function (Paradigm D)

```cpp
#include <iostream>
using namespace std;
void printDigits(int n) {
    if (n == 0) return;
    cout << n % 10 << "\n";
    printDigits(n / 10);
}
int main() {
    int n;
    cin >> n;
    printDigits(n);
}
```

**Expected grading:** 5/5  
**Key reasoning:** "Recursive approach. `printDigits(n)` on line 11 satisfies d_c1 indirectly (n is read on line 10 via `cin >> n`). The recursive function extracts `n%10` (least-significant digit) first on line 5, then recurses on `n/10` — producing reverse-order digits. d_c2 and d_c3 satisfied."

---

### B3 — String Conversion Approach

```cpp
#include <iostream>
#include <string>
using namespace std;
int main() {
    int n;
    cin >> n;
    string s = to_string(n);
    for (int i = s.size() - 1; i >= 0; i--)
        cout << s[i] << "\n";
}
```

**Expected grading:** 5/5  
**Key reasoning:** "`to_string(n)` converts to string; iterating from `s.size()-1` to `0` traverses characters from least-significant digit to most-significant. Each character printed on its own line. d_c2: satisfied — the reverse traversal of string digits is algorithmically equivalent to `n%10` extraction. d_c3: `\"\n\"` on line 8."

---

### B4 — Stack-Based (Using `std::stack`)

```cpp
#include <iostream>
#include <stack>
using namespace std;
int main() {
    int n;
    cin >> n;
    stack<int> st;
    while (n > 0) { st.push(n % 10); n /= 10; }
    while (!st.empty()) { cout << st.top() << "\n"; st.pop(); }
}
```

**Expected grading:** d_c1=1, d_c2=3, **d_c3=1 → Total 5/5**  
**Key reasoning:** "`st.push(n%10)` accumulates digits in push order (least-significant first into stack). `st.top()` pops in LIFO order = most-significant first. Wait — this actually outputs most-significant digit first (not reverse). BUT: for the reverse-digit task, the question asks for least-significant first. Stack push order is least-sig-first; pop order is most-sig-first = original order. **This would award d_c2 = 0** for reverse order if stack pop reverses the reversal."

**Correction:** Award d_c2 = **0** (the stack approach produces original digit order, not reverse). Correct total = **2/5**. This is a genuine logic error — demonstrates Group C behaviour. *(Included here as a corrected example showing the grader must reason carefully about algorithmic order.)*

---

### B5 — `do-while` Loop (Paradigm C)

```cpp
#include <iostream>
using namespace std;
int main() {
    int n;
    cin >> n;
    do {
        cout << n % 10 << endl;
        n /= 10;
    } while (n != 0);
}
```

**Expected grading:** 5/5  
**Key reasoning:** "`do-while` with `n != 0` condition is semantically equivalent to `while (n > 0)` for positive integers. `n%10` extracts LSB first; `n/=10` advances. `endl` flushes each digit to its own line. Full marks."

---

## Group C — Genuine Logic Bugs → SHOULD Receive Partial or Zero Credit

> [!NOTE]
> These examples have real logical errors that justify deductions, regardless of whether the code compiles.

---

### C1 — Off-by-One: Prints Leading Zero

```cpp
#include <iostream>
using namespace std;
int main() {
    int n;
    cin >> n;
    while (n >= 0) {   // BUG: should be n > 0
        cout << n % 10 << "\n";
        n /= 10;
    }
}
```

**Expected grading:** d_c1=1, d_c2=**2** (partial), d_c3=1 → Total **4/5**  
**Key reasoning:** "The loop condition `n >= 0` on line 6 causes one extra iteration after the last digit is extracted (`n` becomes 0), printing a spurious `0`. This is a logical off-by-one error. d_c2 receives 2/3: digit extraction logic is correct but the termination condition introduces an extra output."

---

### C2 — Wrong Operator: Uses Addition Instead of Modulo

```cpp
#include <iostream>
using namespace std;
int main() {
    int n;
    cin >> n;
    while (n > 0) {
        cout << n + 10 << "\n";   // BUG: should be n % 10
        n /= 10;
    }
}
```

**Expected grading:** d_c1=1, d_c2=**0**, d_c3=1 → Total **2/5**  
**Key reasoning:** "`n + 10` on line 7 adds 10 to the number rather than extracting its last digit. This does not implement the reverse-digit algorithm. d_c2 is 0/3. d_c3 (one per line) is satisfied by `\"\n\"`."

---

### C3 — Uninitialised Accumulator / Missing Loop

```cpp
#include <iostream>
using namespace std;
int main() {
    int n;
    cin >> n;
    int d = n % 10;
    cout << d << "\n";
}
```

**Expected grading:** d_c1=1, d_c2=**1** (partial — only one digit extracted), d_c3=1 → Total **3/5**  
**Key reasoning:** "Line 6 extracts only the last digit (units digit). There is no loop — only one digit is ever output regardless of the number of digits in `n`. d_c2: 1/3 — partial credit for demonstrating the `n%10` extraction concept but failing to iterate over all digits."

---

### C4 — Hardcoded Output

```cpp
#include <iostream>
using namespace std;
int main() {
    cin >> n;    // also: n undeclared
    cout << "3\n2\n1\n";
}
```

**Expected grading:** d_c1=**0** (undeclared `n`), d_c2=**0** (hardcoded), d_c3=**0** → Total **0/5**  
**Key reasoning:** "`n` is used without declaration on line 4 — but even overlooking the syntax, the output `\"3\\n2\\n1\\n\"` is a hardcoded string that works only for input `123`. This demonstrates no algorithmic understanding of digit extraction or reversal. All criteria awarded 0."

---

### C5 — Correct Read, Wrong Loop Direction (Prints Forward, Not Reversed)

```cpp
#include <iostream>
#include <vector>
using namespace std;
int main() {
    int n;
    cin >> n;
    vector<int> digits;
    while (n > 0) { digits.push_back(n % 10); n /= 10; }
    for (int i = digits.size() - 1; i >= 0; i--)  // BUG: iterates backwards = original order
        cout << digits[i] << "\n";
}
```

**Expected grading:** d_c1=1, d_c2=**0**, d_c3=1 → Total **2/5**  
**Key reasoning:** "Digits are pushed in LSB-first order into the vector (line 8). Iterating with `i = digits.size()-1` down to 0 (line 9) then outputs them in MSB-first (original) order — the OPPOSITE of what is required. d_c2 is 0/3: the reversal logic is inverted."

---

## Group D — Naming & Spelling Variations → SHOULD Receive Full Credit

> [!NOTE]
> Variable names, spellings, and identifiers MUST NEVER affect marks.

---

### D1 — Urdu/Transliterated Identifiers

```cpp
#include <iostream>
using namespace std;
int main() {
    int adad;
    cin >> adad;
    while (adad > 0) {
        int hissa = adad % 10;
        cout << hissa << "\n";
        adad = adad / 10;
    }
}
```

*(adad = number, hissa = part/digit in Urdu)*  
**Expected grading:** 5/5  
**Key reasoning:** "`adad` and `hissa` are Urdu-transliterated variable names. Identifier choice has no bearing on logical correctness. The algorithm is identical to the reference solution with `n` and `d`."

---

### D2 — Misspelled Identifiers (`numbr`, `digitt`, `countr`)

```cpp
#include <iostream>
using namespace std;
int main() {
    int numbr;
    cin >> numbr;
    int countr = 0;
    while (numbr > 0) {
        int digitt = numbr % 10;
        cout << digitt << "\n";
        numbr /= 10;
        countr++;
    }
}
```

**Expected grading:** 5/5  
**Key reasoning:** "`numbr`, `digitt`, `countr` are misspelled identifiers. Spelling of identifiers is irrelevant to logical correctness. The algorithm correctly extracts digits in reverse order. `countr` is an unused accumulator — superfluous but harmless."

---

### D3 — Single-Letter Variables

```cpp
#include <iostream>
using namespace std;
int main() {
    int a;
    cin >> a;
    while (a > 0) {
        int b = a % 10;
        cout << b << "\n";
        a /= 10;
    }
}
```

**Expected grading:** 5/5  
**Key reasoning:** "`a` and `b` are minimal single-letter names. No impact on grading. Algorithm is equivalent to the reference solution."

---

### D4 — camelCase vs snake_case Mix + Urdu Comment

```cpp
#include <iostream>
using namespace std;
int main() {
    int myNumber;      // mera number
    cin >> myNumber;
    while (myNumber > 0) {
        int lastDigit = myNumber % 10;  // آخری ہندسہ
        cout << lastDigit << "\n";
        myNumber = myNumber / 10;
    }
}
```

**Expected grading:** 5/5  
**Key reasoning:** "Comments in Urdu (line 7: 'last digit') are non-code and irrelevant. `myNumber`, `lastDigit` use camelCase — style is irrelevant. Algorithm is fully correct."

---

### D5 — Spelling Error in `cout` String Literal + Extra Debug Output

```cpp
#include <iostream>
using namespace std;
int main() {
    int num;
    cin >> num;
    cout << "Reveresed diggits:" << "\n";   // misspelled "Reversed digits"
    while (num > 0) {
        cout << num % 10 << "\n";
        num /= 10;
    }
}
```

**Expected grading:** d_c1=1, d_c2=3, d_c3=**1** → Total **5/5**  
**Key reasoning:** "Line 6 prints a misspelled banner string — this is a cosmetic output artifact and does not affect the digit extraction logic. The rubric criterion d_c3 requires 'each digit on its own line' — each digit IS on its own line. The extra banner line is not penalised. Spelling in `cout` string literals is never penalised."

---

## Scan-Derived Text Variant Note

For submissions where student code is derived from scanned handwritten scripts (not typed), the grader should indicate:

> **Execution report is indicative; may reflect transcription noise.** Transcription errors (incorrect characters, merged tokens, extra whitespace) may prevent compilation but do not necessarily reflect the student's intended logic. Training examples exist where transcription noise breaks compilation but full logic marks are awarded.

**Example scan-noise pattern that must NOT reduce marks:**
- `cin >> n;` → `c1n >> n;` (OCR misreads 'i' as '1')  
- `cout <<` → `cout <<` (unchanged) but `endl` → `end1` (1 instead of l)  
- `n % 10` → `n % 1O` (capital O instead of zero)

In all these cases: logic marks are awarded based on the **inferred intended logic**, not the character-level transcription.
