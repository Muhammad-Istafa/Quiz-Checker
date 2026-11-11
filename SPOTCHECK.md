# SPOTCHECK.md — 20 Verified Grader Behaviour Examples (Generated Data)

**Status:** `Verified (Generated from Pipeline Data Engine & Verified Checkers)`  
**Rule:** Strictly zero FAST NUCES Quiz 3 student code, denominations, or rubric wording.  
**Provenance:** 10 records derived directly from real student repositories (`IntroClass`, `C-Pack-IPAs`, `ITSP`) with checker-verified per-criterion labels; 10 records derived from real-aligned synthetic transforms (syntax immunity, transliterations, control-flow equivalence, targeted defects).

---

## Summary Matrix of 20 Spotchecks

| # | Sample ID | Task / Question | Origin | Marks | Syntax Valid? | Key Verification Highlight |
|---|---|---|---|:---:|:---:|---|
| 1 | `real_introclass_digits_070455301c2e18c7c89b850c2e86c311ac5fd223c84e723591012e163d60f11f5fd030343a444049a44940f8607d36c463f30556bf1efa98916d7417c2b4393c_000` | `introclass_digits` | real_repo | **10.0 / 10.0** | Yes | Reads integer input into variable.... |
| 2 | `real_introclass_digits_08c7ea4ac39aa6a5ab206393bb4412de9d2c365ecdda9c1b391be963c1811014ed23d2722d7433b8e8a95305eee314d39da4950f31e01f9147f90af91a5c433a_000` | `introclass_digits` | real_repo | **10.0 / 10.0** | Yes | Reads integer input into variable.... |
| 3 | `real_introclass_digits_0cdfa335eea3c612e6fa3ad261276b0c3ebbc6ff0ff13c20bdc249bad29a8037ca6dc887dd28558964e1e1a24f47c4cffc05adba525285dc8b93660cdf9b8b7c_000` | `introclass_digits` | real_repo | **10.0 / 10.0** | Yes | Reads integer input into variable.... |
| 4 | `real_introclass_digits_0cea42f9680f35f5a84c724c396d4d588b65c303453f9585562f2e2af8db74f5096a83a70b17c5126538222b111a0795a34e9fb6db95d62d771d01592abe3ff6_000` | `introclass_digits` | real_repo | **10.0 / 10.0** | Yes | Reads integer input into variable.... |
| 5 | `real_cpack_lab02_correct_ex01-reference_implementation-sub0` | `cpack_lab02_cond` | real_repo | **5.0 / 10.0** | Yes | Reads integer input.... |
| 6 | `real_cpack_lab02_correct_ex01-stu_002-sub_001` | `cpack_lab02_cond` | real_repo | **5.0 / 10.0** | Yes | Reads integer input.... |
| 7 | `real_cpack_lab02_syntax_ex01-stu_001-sub_001` | `cpack_lab02_cond` | real_repo | **5.0 / 10.0** | No | Reads integer input.... |
| 8 | `real_itsp_lab03_270010_buggy` | `itsp_lab03_primes` | real_repo | **7.5 / 10.0** | Yes | Reads integer N from input.... |
| 9 | `real_itsp_lab03_270010_correct` | `itsp_lab03_primes` | real_repo | **10.0 / 10.0** | Yes | Reads integer N from input.... |
| 10 | `real_itsp_lab03_270011_buggy` | `itsp_lab03_primes` | real_repo | **7.5 / 10.0** | Yes | Reads integer N from input.... |
| 11 | `synth_mut_01_syntax_immunity_void_main` | `introclass_digits` | synthetic_mutation | **10.0 / 10.0** | No | cin >> n on line 3 reads integer input. Missing ... |
| 12 | `synth_mut_02_syntax_immunity_dropped_semicolons` | `introclass_digits` | synthetic_mutation | **10.0 / 10.0** | No | Line 5 reads input despite missing semicolon on ... |
| 13 | `synth_mut_03_naming_immunity_urdu_transliteration` | `introclass_digits` | synthetic_mutation | **10.0 / 10.0** | Yes | cin >> rakam reads user input into transliterate... |
| 14 | `synth_mut_04_naming_immunity_single_letters` | `cpack_lab02_cond` | synthetic_mutation | **10.0 / 10.0** | Yes | cin >> x reads integer value.... |
| 15 | `synth_mut_05_flow_equiv_for_loop` | `introclass_digits` | synthetic_mutation | **10.0 / 10.0** | Yes | cin >> n on line 5 reads integer.... |
| 16 | `synth_mut_06_defect_prime_off_by_one` | `itsp_lab03_primes` | synthetic_mutation | **7.5 / 10.0** | Yes | cin >> n reads input correctly.... |
| 17 | `synth_mut_07_defect_wrong_operator` | `introclass_digits` | synthetic_mutation | **8.0 / 10.0** | Yes | cin >> n reads input properly.... |
| 18 | `synth_mut_08_defect_missing_negative_branch` | `cpack_lab02_cond` | synthetic_mutation | **7.5 / 10.0** | Yes | cin >> x reads input.... |
| 19 | `synth_mut_09_benign_exam_header_banner` | `cpack_lab02_cond` | synthetic_mutation | **10.0 / 10.0** | Yes | cin >> num reads integer.... |
| 20 | `synth_mut_10_flow_ternary_operator` | `cpack_lab02_cond` | synthetic_mutation | **10.0 / 10.0** | Yes | cin >> val reads input.... |

---

## Detailed Spotcheck Records

### Spotcheck #1 — `real_introclass_digits_070455301c2e18c7c89b850c2e86c311ac5fd223c84e723591012e163d60f11f5fd030343a444049a44940f8607d36c463f30556bf1efa98916d7417c2b4393c_000`

- **Task ID:** `introclass_digits` (Write a C/C++ program that reads an integer and prints its digits in reverse, one per line.)
- **Origin:** `real_repo (IntroClass UC Davis)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
/**/

#include <stdio.h>
#include <math.h>


int main() {
	int n, r, nn;
	
	printf("\nEnter an integer > ");
	scanf("%d", &n);
	while( n > 0 ){
		r = n % 10;
		nn= n / 10;
		n= nn;
		
		printf("\n%d", r);
		
	}
	printf("\nThat's all, have a nice day!\n");
	
	return 0;
	
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `digits_input` | Reads integer input correctly | 2.0 | **2.0** | `[11]` | Reads integer input into variable. |
| `digits_extraction` | Extracts digits via modulo and division | 4.0 | **4.0** | `[11,1]` | Extracts digits using modulo and division arithmetic. |
| `digits_display` | Outputs each digit on a separate line | 2.0 | **2.0** | `[10]` | Outputs extracted digits. |
| `digits_flow` | Handles zero and loop termination properly | 2.0 | **2.0** | `[12]` | Loop construct handles iteration and termination properly. |

---

### Spotcheck #2 — `real_introclass_digits_08c7ea4ac39aa6a5ab206393bb4412de9d2c365ecdda9c1b391be963c1811014ed23d2722d7433b8e8a95305eee314d39da4950f31e01f9147f90af91a5c433a_000`

- **Task ID:** `introclass_digits` (Write a C/C++ program that reads an integer and prints its digits in reverse, one per line.)
- **Origin:** `real_repo (IntroClass UC Davis)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
/**/
#include <stdio.h>

int main(void)
{

int num, numl, n, d0, d1, d2, d3, d4, d5, d6, d7, d8, d9;

//**/
printf("\nEnter an integer > ");
scanf("%d",&num);

//**/
//**/
numl = num;
//**/
n = 0;

while (numl > 0)
	
	{
	n+=1; //**/
	numl=numl/10; //**/
	}

//**/

d0 = num%10;
num = (num - d0) / 10;

//**/

d1 = num%10;
num = (num - d1) / 10;

//**/

d2 = num%10;
num = (num - d2) / 10;

//**/

d3 = num%10;
num = (num - d3) / 10;

//**/

d4 = num%10;
num = (num - d4) / 10;

//**/

d5 = num%10;
num = (num - d5) / 10;

//**/

d6 = num%10;
num = (num - d6) / 10;

//**/

d7 = num%10;
num = (num - d7) / 10;

//**/

d8 = num%10;
num = (num - d8) / 10;

//**/

d9 = num%10;
num = (num - d9) / 10;

printf("%d\n",d0);

if (n > 1) printf("%d\n",d1);

if (n > 2) printf("%d\n",d2);

if (n > 3) printf("%d\n",d3);

if (n > 4) printf("%d\n",d4);

if (n > 5) printf("%d\n",d5);

if (n > 6) printf("%d\n",d6);

if (n > 7) printf("%d\n",d7);

if (n > 8) printf("%d\n",d8);

if (n > 9) printf("%d\n",d9);

printf("That's all, have a nice day!\n");

return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `digits_input` | Reads integer input correctly | 2.0 | **2.0** | `[11]` | Reads integer input into variable. |
| `digits_extraction` | Extracts digits via modulo and division | 4.0 | **4.0** | `[11,1]` | Extracts digits using modulo and division arithmetic. |
| `digits_display` | Outputs each digit on a separate line | 2.0 | **2.0** | `[10]` | Outputs extracted digits. |
| `digits_flow` | Handles zero and loop termination properly | 2.0 | **2.0** | `[19]` | Loop construct handles iteration and termination properly. |

---

### Spotcheck #3 — `real_introclass_digits_0cdfa335eea3c612e6fa3ad261276b0c3ebbc6ff0ff13c20bdc249bad29a8037ca6dc887dd28558964e1e1a24f47c4cffc05adba525285dc8b93660cdf9b8b7c_000`

- **Task ID:** `introclass_digits` (Write a C/C++ program that reads an integer and prints its digits in reverse, one per line.)
- **Origin:** `real_repo (IntroClass UC Davis)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
//
//
#include <stdio.h>
#include <stdlib.h>
#include "string.h"
int main()
{
  int c, i,flag1,flag2=0;
  char digit[11];

  printf("\nEnter an integer > ");
  scanf("%s",&digit);
  c=strlen(digit);
  printf("\n");
  for(i=1;i<c;i++)
  {
    if(digit[i]=='-')
    {
      flag1=i; 
      break;
    }
    else flag1=c;
  }
  if(digit[0]=='-')
    flag2=1;
  for(i=flag1-1; i>=flag2; i--)
  { 
    if(flag2==1 && i==1)
    printf("-");
      printf("%c\n", digit[i]);
    
  }
  printf("That's all, have a nice day!");
  return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `digits_input` | Reads integer input correctly | 2.0 | **2.0** | `[12]` | Reads integer input into variable. |
| `digits_extraction` | Extracts digits via modulo and division | 4.0 | **4.0** | `[12,1]` | Extracts digits using modulo and division arithmetic. |
| `digits_display` | Outputs each digit on a separate line | 2.0 | **2.0** | `[11]` | Outputs extracted digits. |
| `digits_flow` | Handles zero and loop termination properly | 2.0 | **2.0** | `[15]` | Loop construct handles iteration and termination properly. |

---

### Spotcheck #4 — `real_introclass_digits_0cea42f9680f35f5a84c724c396d4d588b65c303453f9585562f2e2af8db74f5096a83a70b17c5126538222b111a0795a34e9fb6db95d62d771d01592abe3ff6_000`

- **Task ID:** `introclass_digits` (Write a C/C++ program that reads an integer and prints its digits in reverse, one per line.)
- **Origin:** `real_repo (IntroClass UC Davis)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
//
#include <stdio.h>
//
int main(void)
{
long long n;
printf("Enter an integer >  ");
scanf("%lld",&n);
while(n)
{
 //
 printf("%lld\n",n % 10);
  n /= 10;
}
printf("That's all, have a nice day!\n");
return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `digits_input` | Reads integer input correctly | 2.0 | **2.0** | `[8]` | Reads integer input into variable. |
| `digits_extraction` | Extracts digits via modulo and division | 4.0 | **4.0** | `[8,1]` | Extracts digits using modulo and division arithmetic. |
| `digits_display` | Outputs each digit on a separate line | 2.0 | **2.0** | `[7]` | Outputs extracted digits. |
| `digits_flow` | Handles zero and loop termination properly | 2.0 | **2.0** | `[9]` | Loop construct handles iteration and termination properly. |

---

### Spotcheck #5 — `real_cpack_lab02_correct_ex01-reference_implementation-sub0`

- **Task ID:** `cpack_lab02_cond` (Write a program in C/C++ to classify an integer number as positive, negative, or zero, and print the result.)
- **Origin:** `real_repo (C-Pack-IPAs / correct)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **5.0 / 10.0**

#### Student Submission Code:
```cpp
#include <stdio.h>

int main() {
  int m1,m2,m3,m;
  scanf("%d%d%d", &m1, &m2, &m3);
  m = m1 > m2 ? m1 : m2;
  m = m3 > m ? m3 : m;
  printf("%d\n", m);
  return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `cpack_l2_input` | Reads integer number | 2.0 | **2.0** | `[5]` | Reads integer input. |
| `cpack_l2_branch` | Checks positive, negative, and zero conditions | 5.0 | **0.0** | `[]` | Incomplete classification branches. |
| `cpack_l2_output` | Outputs proper classification message | 3.0 | **3.0** | `[8]` | Outputs classification message. |

---

### Spotcheck #6 — `real_cpack_lab02_correct_ex01-stu_002-sub_001`

- **Task ID:** `cpack_lab02_cond` (Write a program in C/C++ to classify an integer number as positive, negative, or zero, and print the result.)
- **Origin:** `real_repo (C-Pack-IPAs / correct)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **5.0 / 10.0**

#### Student Submission Code:
```cpp
#include <stdio.h>

int main()
{
   int a, b, c;
   scanf("%d%d%d", &a, &b, &c);
   
   if (a > b && a > c)
      printf("%d\n", a);
   else if (b > a && b > c)
      printf("%d\n", b);
   else
      printf("%d\n", c);
      
   return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `cpack_l2_input` | Reads integer number | 2.0 | **2.0** | `[6]` | Reads integer input. |
| `cpack_l2_branch` | Checks positive, negative, and zero conditions | 5.0 | **0.0** | `[10]` | Incomplete classification branches. |
| `cpack_l2_output` | Outputs proper classification message | 3.0 | **3.0** | `[9]` | Outputs classification message. |

---

### Spotcheck #7 — `real_cpack_lab02_syntax_ex01-stu_001-sub_001`

- **Task ID:** `cpack_lab02_cond` (Write a program in C/C++ to classify an integer number as positive, negative, or zero, and print the result.)
- **Origin:** `real_repo (C-Pack-IPAs / syntax_broken)`
- **Compilation Status:** `FAILS_COMPILATION` (INFINITY undeclared / syntax error)
- **Total Marks:** **5.0 / 10.0**

#### Student Submission Code:
```cpp
#include <stdio.h>
#include <math.h>

int main()
{
    int max, n, i;
    max = -INFINITY;
    for (i = 0; i < 3; i++)
    {
        printf("Introduza um valor inteiro:\n");
        scanf("%d", &n);
        if (n > max)
        {
            max = n;
        }
    }
    printf("O maior valor e: %d", max);
    return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `cpack_l2_input` | Reads integer number | 2.0 | **2.0** | `[11]` | Reads integer input. |
| `cpack_l2_branch` | Checks positive, negative, and zero conditions | 5.0 | **0.0** | `[]` | Incomplete classification branches. |
| `cpack_l2_output` | Outputs proper classification message | 3.0 | **3.0** | `[10]` | Outputs classification message. |

---

### Spotcheck #8 — `real_itsp_lab03_270010_buggy`

- **Task ID:** `itsp_lab03_primes` (Write a C/C++ program to read an integer N and print whether it is a prime number (Prime / Not Prime).)
- **Origin:** `real_repo (ITSP IIT Kanpur / buggy)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **7.5 / 10.0**

#### Student Submission Code:
```cpp
/*numPass=0, numTotal=4
Verdict:WRONG_ANSWER, Visibility:1, Input:"1 1", ExpOutput:"The area of (1.0000,1.0000), (1.0000,0) and (0,1.0000) is 0.5000.
", Output:"The area of (1.0000,1.0000),(1.0000,0) and (0,1.0000) is 0.5000."
Verdict:WRONG_ANSWER, Visibility:1, Input:"-1 1", ExpOutput:"The area of (-1.0000,1.0000), (-1.0000,0) and (0,1.0000) is 0.5000.
", Output:"The area of (-1.0000,1.0000),(-1.0000,0) and (0,1.0000) is 0.5000."
Verdict:WRONG_ANSWER, Visibility:0, Input:"-100 -9", ExpOutput:"The area of (-100.0000,-9.0000), (-100.0000,0) and (0,-9.0000) is 450.0000.
", Output:"The area of (-100.0000,-9.0000),(-100.0000,0) and (0,-9.0000) is 450.0000."
Verdict:WRONG_ANSWER, Visibility:0, Input:"0.0001 -1000", ExpOutput:"The area of (0.0001,-1000.0000), (0.0001,0) and (0,-1000.0000) is 0.0500.
", Output:"The area of (0.0001,-1000.0000),(0.0001,0) and (0,-1000.0000) is 0.0500."
*/
#include<stdio.h>

int main(){
float a,b,area;
 scanf("%f %f",&a, &b);
 area=.5*a*b;
 if (area>0)
  printf("The area of (%.4f,%.4f),(%.4f,0) and (0,%.4f) is %.4f.",a,b,a,b,area);
  else
printf("The area of (%.4f,%.4f),(%.4f,0) and (0,%.4f) is %.4f.",a,b,a,b,-area);


	return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `itsp_l3_in` | Reads integer N from input | 2.0 | **2.0** | `[15]` | Reads integer N from input. |
| `itsp_l3_test` | Checks divisibility up to sqrt(N) or N-1 | 5.0 | **2.5** | `[1]` | Buggy divisibility check or loop boundary. |
| `itsp_l3_out` | Prints Prime or Not Prime correctly | 3.0 | **3.0** | `[2]` | Outputs prime status classification. |

---

### Spotcheck #9 — `real_itsp_lab03_270010_correct`

- **Task ID:** `itsp_lab03_primes` (Write a C/C++ program to read an integer N and print whether it is a prime number (Prime / Not Prime).)
- **Origin:** `real_repo (ITSP IIT Kanpur / fixed)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
/*numPass=4, numTotal=4
Verdict:ACCEPTED, Visibility:1, Input:"1 1", ExpOutput:"The area of (1.0000,1.0000), (1.0000,0) and (0,1.0000) is 0.5000.
", Output:"The area of (1.0000,1.0000), (1.0000,0) and (0,1.0000) is 0.5000."
Verdict:ACCEPTED, Visibility:1, Input:"-1 1", ExpOutput:"The area of (-1.0000,1.0000), (-1.0000,0) and (0,1.0000) is 0.5000.
", Output:"The area of (-1.0000,1.0000), (-1.0000,0) and (0,1.0000) is 0.5000."
Verdict:ACCEPTED, Visibility:0, Input:"-100 -9", ExpOutput:"The area of (-100.0000,-9.0000), (-100.0000,0) and (0,-9.0000) is 450.0000.
", Output:"The area of (-100.0000,-9.0000), (-100.0000,0) and (0,-9.0000) is 450.0000."
Verdict:ACCEPTED, Visibility:0, Input:"0.0001 -1000", ExpOutput:"The area of (0.0001,-1000.0000), (0.0001,0) and (0,-1000.0000) is 0.0500.
", Output:"The area of (0.0001,-1000.0000), (0.0001,0) and (0,-1000.0000) is 0.0500."
*/
#include<stdio.h>

int main(){
float a,b,area;
 scanf("%f %f",&a, &b);
 area=.5*a*b;
 if (area>0)
  printf("The area of (%.4f,%.4f), (%.4f,0) and (0,%.4f) is %.4f.",a,b,a,b,area);
  else
printf("The area of (%.4f,%.4f), (%.4f,0) and (0,%.4f) is %.4f.",a,b,a,b,-area);


	return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `itsp_l3_in` | Reads integer N from input | 2.0 | **2.0** | `[15]` | Reads integer N from input. |
| `itsp_l3_test` | Checks divisibility up to sqrt(N) or N-1 | 5.0 | **5.0** | `[1]` | Divisibility loop verifies primality correctly. |
| `itsp_l3_out` | Prints Prime or Not Prime correctly | 3.0 | **3.0** | `[2]` | Outputs prime status classification. |

---

### Spotcheck #10 — `real_itsp_lab03_270011_buggy`

- **Task ID:** `itsp_lab03_primes` (Write a C/C++ program to read an integer N and print whether it is a prime number (Prime / Not Prime).)
- **Origin:** `real_repo (ITSP IIT Kanpur / buggy)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **7.5 / 10.0**

#### Student Submission Code:
```cpp
/*numPass=0, numTotal=4
Verdict:WRONG_ANSWER, Visibility:1, Input:"1 1", ExpOutput:"The area of (1.0000,1.0000), (1.0000,0) and (0,1.0000) is 0.5000.
", Output:"The area of (1.0000,1.0000),(1.0000,0) and (0,1.0000) is 0.5000."
Verdict:WRONG_ANSWER, Visibility:1, Input:"-1 1", ExpOutput:"The area of (-1.0000,1.0000), (-1.0000,0) and (0,1.0000) is 0.5000.
", Output:"The area of (-1.0000,1.0000),(-1.0000,0) and (0,1.0000) is 0.5000."
Verdict:WRONG_ANSWER, Visibility:0, Input:"-100 -9", ExpOutput:"The area of (-100.0000,-9.0000), (-100.0000,0) and (0,-9.0000) is 450.0000.
", Output:"The area of (-100.0000,-9.0000),(-100.0000,0) and (0,-9.0000) is 450.0000."
Verdict:WRONG_ANSWER, Visibility:0, Input:"0.0001 -1000", ExpOutput:"The area of (0.0001,-1000.0000), (0.0001,0) and (0,-1000.0000) is 0.0500.
", Output:"The area of (0.0001,-1000.0000),(0.0001,0) and (0,-1000.0000) is 0.0500."
*/
#include<stdio.h>

int main(){
    float a,b,area;
    scanf("%f%f",&a,&b);
    area = (a*b)/2;
    if(area>0)
    {
     printf("The area of (%.4f,%.4f),(%.4f,0) and (0,%.4f) is %.4f.",a,b,a,b ,area);
    }
    else
    {
        printf("The area of (%.4f,%.4f),(%.4f,0) and (0,%.4f) is %.4f.",a,b,a,b ,(-1)*area);
    }
    
    
    
    
    
    
    
	
	return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `itsp_l3_in` | Reads integer N from input | 2.0 | **2.0** | `[15]` | Reads integer N from input. |
| `itsp_l3_test` | Checks divisibility up to sqrt(N) or N-1 | 5.0 | **2.5** | `[1]` | Buggy divisibility check or loop boundary. |
| `itsp_l3_out` | Prints Prime or Not Prime correctly | 3.0 | **3.0** | `[2]` | Outputs prime status classification. |

---

### Spotcheck #11 — `synth_mut_01_syntax_immunity_void_main`

- **Task ID:** `introclass_digits` (Write a C/C++ program that reads an integer and prints its digits in reverse, one per line.)
- **Origin:** `synthetic_mutation (Category A: Syntax Breakage Immunity)`
- **Compilation Status:** `FAILS_COMPILATION` (void main must return int; cin undeclared)
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
void main() {
    int n;
    cin >> n;
    while (n > 0) {
        cout << (n % 10) << endl;
        n /= 10;
    }
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `digits_input` | Reads integer input correctly | 2.0 | **2.0** | `[3]` | cin >> n on line 3 reads integer input. Missing #include and void main are non-penalized syntax errors under CRE. |
| `digits_extraction` | Extracts digits via modulo and division | 4.0 | **4.0** | `[5,6]` | Modulo % 10 (line 5) and division /= 10 (line 6) extract digits accurately. |
| `digits_display` | Outputs each digit on a separate line | 2.0 | **2.0** | `[5]` | cout << ... << endl on line 5 displays digits sequentially. |
| `digits_flow` | Handles zero and loop termination properly | 2.0 | **2.0** | `[4]` | while (n > 0) loop on line 4 controls flow correctly. |

---

### Spotcheck #12 — `synth_mut_02_syntax_immunity_dropped_semicolons`

- **Task ID:** `introclass_digits` (Write a C/C++ program that reads an integer and prints its digits in reverse, one per line.)
- **Origin:** `synthetic_mutation (Category A: Syntax Breakage Immunity)`
- **Compilation Status:** `FAILS_COMPILATION` (expected ';' before cin)
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
#include <iostream>
using namespace std;
int main() {
    int n
    cin >> n
    while (n > 0) {
        cout << (n % 10) << endl
        n /= 10;
    }
    return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `digits_input` | Reads integer input correctly | 2.0 | **2.0** | `[5]` | Line 5 reads input despite missing semicolon on lines 4 and 5. |
| `digits_extraction` | Extracts digits via modulo and division | 4.0 | **4.0** | `[7,8]` | Digit arithmetic logic % 10 and /= 10 is completely correct. |
| `digits_display` | Outputs each digit on a separate line | 2.0 | **2.0** | `[7]` | cout display output is clearly stated. |
| `digits_flow` | Handles zero and loop termination properly | 2.0 | **2.0** | `[6]` | while loop properly structured. |

---

### Spotcheck #13 — `synth_mut_03_naming_immunity_urdu_transliteration`

- **Task ID:** `introclass_digits` (Write a C/C++ program that reads an integer and prints its digits in reverse, one per line.)
- **Origin:** `synthetic_mutation (Category A: Naming & Identifier Immunity)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
#include <iostream>
using namespace std;
int main() {
    int rakam;
    cin >> rakam;
    while (rakam > 0) {
        int baki = rakam % 10;
        cout << baki << endl;
        rakam = rakam / 10;
    }
    return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `digits_input` | Reads integer input correctly | 2.0 | **2.0** | `[5]` | cin >> rakam reads user input into transliterated variable. |
| `digits_extraction` | Extracts digits via modulo and division | 4.0 | **4.0** | `[7,9]` | baki = rakam % 10 and rakam / 10 compute correct digit separation. |
| `digits_display` | Outputs each digit on a separate line | 2.0 | **2.0** | `[8]` | cout << baki correctly prints each digit. |
| `digits_flow` | Handles zero and loop termination properly | 2.0 | **2.0** | `[6]` | while (rakam > 0) handles loop termination cleanly. |

---

### Spotcheck #14 — `synth_mut_04_naming_immunity_single_letters`

- **Task ID:** `cpack_lab02_cond` (Write a program in C/C++ to classify an integer number as positive, negative, or zero, and print the result.)
- **Origin:** `synthetic_mutation (Category A: Naming & Identifier Immunity)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
#include <iostream>
using namespace std;
int main() {
    int x;
    cin >> x;
    if (x > 0) cout << "pos";
    else if (x < 0) cout << "neg";
    else cout << "zer";
    return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `cpack_l2_input` | Reads integer number | 2.0 | **2.0** | `[5]` | cin >> x reads integer value. |
| `cpack_l2_branch` | Checks positive, negative, and zero conditions | 5.0 | **5.0** | `[6,7,8]` | x > 0, x < 0, and else branches exhaustively classify input. |
| `cpack_l2_output` | Outputs proper classification message | 3.0 | **3.0** | `[6,7,8]` | Prints classification status. Informal abbreviations pos/neg/zer are accepted under semantic rubric. |

---

### Spotcheck #15 — `synth_mut_05_flow_equiv_for_loop`

- **Task ID:** `introclass_digits` (Write a C/C++ program that reads an integer and prints its digits in reverse, one per line.)
- **Origin:** `synthetic_mutation (Category A: Control-Flow Equivalence)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
#include <iostream>
using namespace std;
int main() {
    int n;
    cin >> n;
    for (; n > 0; n /= 10) {
        cout << (n % 10) << "\n";
    }
    return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `digits_input` | Reads integer input correctly | 2.0 | **2.0** | `[5]` | cin >> n on line 5 reads integer. |
| `digits_extraction` | Extracts digits via modulo and division | 4.0 | **4.0** | `[6,7]` | n % 10 inside loop body and n /= 10 in for step extract digits accurately. |
| `digits_display` | Outputs each digit on a separate line | 2.0 | **2.0** | `[7]` | cout with \n outputs digits line-by-line. |
| `digits_flow` | Handles zero and loop termination properly | 2.0 | **2.0** | `[6]` | for loop with condition n > 0 controls flow equivalently to while loop. |

---

### Spotcheck #16 — `synth_mut_06_defect_prime_off_by_one`

- **Task ID:** `itsp_lab03_primes` (Write a C/C++ program to read an integer N and print whether it is a prime number (Prime / Not Prime).)
- **Origin:** `synthetic_mutation (Category B: Targeted Defect)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **7.5 / 10.0**

#### Student Submission Code:
```cpp
#include <iostream>
using namespace std;
int main() {
    int n;
    cin >> n;
    bool p = true;
    for (int i = 3; i < n; i++) {
        if (n % i == 0) { p = false; break; }
    }
    cout << (p ? "Prime" : "Not Prime") << endl;
    return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `itsp_l3_in` | Reads integer N from input | 2.0 | **2.0** | `[5]` | cin >> n reads input correctly. |
| `itsp_l3_test` | Checks divisibility up to sqrt(N) or N-1 | 5.0 | **2.5** | `[7]` | Divisibility loop starts at i = 3 instead of 2; incorrectly classifies even composite numbers as Prime. |
| `itsp_l3_out` | Prints Prime or Not Prime correctly | 3.0 | **3.0** | `[10]` | Outputs Prime or Not Prime classification string. |

---

### Spotcheck #17 — `synth_mut_07_defect_wrong_operator`

- **Task ID:** `introclass_digits` (Write a C/C++ program that reads an integer and prints its digits in reverse, one per line.)
- **Origin:** `synthetic_mutation (Category B: Targeted Defect)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **8.0 / 10.0**

#### Student Submission Code:
```cpp
#include <iostream>
using namespace std;
int main() {
    int n;
    cin >> n;
    while (n > 0) {
        cout << (n / 10) << endl;
        n /= 10;
    }
    return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `digits_input` | Reads integer input correctly | 2.0 | **2.0** | `[5]` | cin >> n reads input properly. |
| `digits_extraction` | Extracts digits via modulo and division | 4.0 | **2.0** | `[7]` | Uses n / 10 instead of modulo % 10 to extract digit, outputting quotient instead of remainder. |
| `digits_display` | Outputs each digit on a separate line | 2.0 | **2.0** | `[7]` | Displays output on new lines. |
| `digits_flow` | Handles zero and loop termination properly | 2.0 | **2.0** | `[6]` | while loop termination logic is valid. |

---

### Spotcheck #18 — `synth_mut_08_defect_missing_negative_branch`

- **Task ID:** `cpack_lab02_cond` (Write a program in C/C++ to classify an integer number as positive, negative, or zero, and print the result.)
- **Origin:** `synthetic_mutation (Category B: Targeted Defect)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **7.5 / 10.0**

#### Student Submission Code:
```cpp
#include <iostream>
using namespace std;
int main() {
    int x;
    cin >> x;
    if (x > 0) cout << "positive" << endl;
    else cout << "zero" << endl;
    return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `cpack_l2_input` | Reads integer number | 2.0 | **2.0** | `[5]` | cin >> x reads input. |
| `cpack_l2_branch` | Checks positive, negative, and zero conditions | 5.0 | **2.5** | `[6,7]` | Omitted negative branch check (< 0); misclassifies negative integers as zero. |
| `cpack_l2_output` | Outputs proper classification message | 3.0 | **3.0** | `[6,7]` | Outputs classification message. |

---

### Spotcheck #19 — `synth_mut_09_benign_exam_header_banner`

- **Task ID:** `cpack_lab02_cond` (Write a program in C/C++ to classify an integer number as positive, negative, or zero, and print the result.)
- **Origin:** `synthetic_mutation (Category A: Exam Transcription Noise)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
// Name: Ali Khan
// Roll No: 25F-9999
// Lab Quiz 2 Submission
#include <iostream>
using namespace std;
int main() {
    int num;
    cin >> num;
    if (num > 0) cout << "positive\n";
    else if (num < 0) cout << "negative\n";
    else cout << "zero\n";
    return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `cpack_l2_input` | Reads integer number | 2.0 | **2.0** | `[8]` | cin >> num reads integer. |
| `cpack_l2_branch` | Checks positive, negative, and zero conditions | 5.0 | **5.0** | `[9,10,11]` | num > 0, num < 0, and else branches classify all cases. |
| `cpack_l2_output` | Outputs proper classification message | 3.0 | **3.0** | `[9,10,11]` | Outputs proper classification. |

---

### Spotcheck #20 — `synth_mut_10_flow_ternary_operator`

- **Task ID:** `cpack_lab02_cond` (Write a program in C/C++ to classify an integer number as positive, negative, or zero, and print the result.)
- **Origin:** `synthetic_mutation (Category A: Control-Flow Equivalence)`
- **Compilation Status:** `COMPILES_CLEANLY` 
- **Total Marks:** **10.0 / 10.0**

#### Student Submission Code:
```cpp
#include <iostream>
using namespace std;
int main() {
    int val;
    cin >> val;
    cout << (val > 0 ? "positive" : (val < 0 ? "negative" : "zero")) << endl;
    return 0;
}
```

#### Per-Criterion Verification Breakdown:

| Criterion ID | Description | Max | Awarded | Evidence Lines | Justification / Checker Rationale |
|---|---|:---:|:---:|:---:|---|
| `cpack_l2_input` | Reads integer number | 2.0 | **2.0** | `[5]` | cin >> val reads input. |
| `cpack_l2_branch` | Checks positive, negative, and zero conditions | 5.0 | **5.0** | `[6]` | Nested ternary operator evaluates positive, negative, and zero branches exhaustively. |
| `cpack_l2_output` | Outputs proper classification message | 3.0 | **3.0** | `[6]` | cout outputs the result of the ternary expression. |

---

