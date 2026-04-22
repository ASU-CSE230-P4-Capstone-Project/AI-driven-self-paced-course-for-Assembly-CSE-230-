-- =============================================================================
-- Lab 2 — Introduction to Bitwise AND (hosted / production friendly)
-- =============================================================================
-- Same memory layout as Labs 0–1: word A @ 0x0, B @ 0x4, SUM @ 0x8 (little-endian).
-- Students compute SUM = A & B (bitwise AND) using lw, and, sw.
-- Idempotent: safe to rerun. Unchanged rows are skipped; changed seed content
-- is updated in place.
-- Lab UID: lab2-intro-bitwise-and
-- =============================================================================

INSERT INTO public.labs (uid, title, md)
VALUES (
  'lab2-intro-bitwise-and',
  'Lab 2: Introduction to Bitwise AND in Assembly Language',
  $LAB2_MD$
# Lab 2: Introduction to Bitwise AND in Assembly Language

## Objective
Write an assembly program that:

1. Loads two integers from memory
2. Computes the **bitwise AND** of those values (`A & B`)
3. Stores the result back in memory

This lab checks whether students understand:
- loading values from memory
- using the bitwise `and` instruction (RV32I)
- storing results back to memory

## Problem Statement
Write a program in RISC-V assembly (RV32I) that does the following:

Read integer `A` from memory.
Read integer `B` from memory.
Compute `A & B` (bitwise AND).
Store the result in memory location `SUM`.

You are given these labels in the data section:

.data
A:   .word 7
B:   .word 5
SUM: .word 0

After the program runs, `SUM` should contain the value `5` (because `7 & 5 = 5`).

## Starter Skeleton
<!-- STUDENT_STARTER -->
~~~asm
.data
A:   .word 7
B:   .word 5
SUM: .word 0

.text
.globl main
main:
    # Your code here

    # End program
    li a7, 10
    ecall
~~~
<!-- STUDENT_STARTER_END -->

## Grading Breakdown
Autograder / emulator — **100 points**

Correctness — 50 points

Test Case 1 passes: 10 pts
Test Case 2 passes: 10 pts
Test Case 3 passes: 10 pts
Test Case 4 passes: 10 pts
Test Case 5 passes: 10 pts

Core instructions (`lw`, `and`, `sw`) used correctly — 30 pts  
Program structure (labels + proper exit) — 20 pts
$LAB2_MD$
)
ON CONFLICT (uid) DO UPDATE
SET title = EXCLUDED.title,
    md = EXCLUDED.md
WHERE public.labs.title IS DISTINCT FROM EXCLUDED.title
   OR public.labs.md IS DISTINCT FROM EXCLUDED.md;

-- Same seed words as Labs 0–1; expected SUM = (A & B) at 0x8–0xb.

INSERT INTO public.test_cases (uid, lab_uid, name, seed_registers, seed_memory, result_registers, result_memory)
VALUES
  (
    'tc-lab2-1',
    'lab2-intro-bitwise-and',
    'Test Case 1',
    '{}',
    '{"0x0":"0x07","0x1":"0x00","0x2":"0x00","0x3":"0x00","0x4":"0x05","0x5":"0x00","0x6":"0x00","0x7":"0x00","0x8":"0x00","0x9":"0x00","0xa":"0x00","0xb":"0x00"}',
    '{}',
    '{"0x8":"0x05","0x9":"0x00","0xa":"0x00","0xb":"0x00"}'
  ),
  (
    'tc-lab2-2',
    'lab2-intro-bitwise-and',
    'Test Case 2',
    '{}',
    '{"0x0":"0x00","0x1":"0x00","0x2":"0x00","0x3":"0x00","0x4":"0x00","0x5":"0x00","0x6":"0x00","0x7":"0x00","0x8":"0x00","0x9":"0x00","0xa":"0x00","0xb":"0x00"}',
    '{}',
    '{"0x8":"0x00","0x9":"0x00","0xa":"0x00","0xb":"0x00"}'
  ),
  (
    'tc-lab2-3',
    'lab2-intro-bitwise-and',
    'Test Case 3',
    '{}',
    '{"0x0":"0x0a","0x1":"0x00","0x2":"0x00","0x3":"0x00","0x4":"0xfd","0x5":"0xff","0x6":"0xff","0x7":"0xff","0x8":"0x00","0x9":"0x00","0xa":"0x00","0xb":"0x00"}',
    '{}',
    '{"0x8":"0x08","0x9":"0x00","0xa":"0x00","0xb":"0x00"}'
  ),
  (
    'tc-lab2-4',
    'lab2-intro-bitwise-and',
    'Test Case 4',
    '{}',
    '{"0x0":"0xf8","0x1":"0xff","0x2":"0xff","0x3":"0xff","0x4":"0xfe","0x5":"0xff","0x6":"0xff","0x7":"0xff","0x8":"0x00","0x9":"0x00","0xa":"0x00","0xb":"0x00"}',
    '{}',
    '{"0x8":"0xf8","0x9":"0xff","0xa":"0xff","0xb":"0xff"}'
  ),
  (
    'tc-lab2-5',
    'lab2-intro-bitwise-and',
    'Test Case 5',
    '{}',
    '{"0x0":"0x64","0x1":"0x00","0x2":"0x00","0x3":"0x00","0x4":"0xfa","0x5":"0x00","0x6":"0x00","0x7":"0x00","0x8":"0x00","0x9":"0x00","0xa":"0x00","0xb":"0x00"}',
    '{}',
    '{"0x8":"0x60","0x9":"0x00","0xa":"0x00","0xb":"0x00"}'
  )
ON CONFLICT (uid) DO UPDATE
SET lab_uid = EXCLUDED.lab_uid,
    name = EXCLUDED.name,
    seed_registers = EXCLUDED.seed_registers,
    seed_memory = EXCLUDED.seed_memory,
    result_registers = EXCLUDED.result_registers,
    result_memory = EXCLUDED.result_memory
WHERE public.test_cases.lab_uid IS DISTINCT FROM EXCLUDED.lab_uid
   OR public.test_cases.name IS DISTINCT FROM EXCLUDED.name
   OR public.test_cases.seed_registers IS DISTINCT FROM EXCLUDED.seed_registers
   OR public.test_cases.seed_memory IS DISTINCT FROM EXCLUDED.seed_memory
   OR public.test_cases.result_registers IS DISTINCT FROM EXCLUDED.result_registers
   OR public.test_cases.result_memory IS DISTINCT FROM EXCLUDED.result_memory;
