export interface LabConfig {
  id: number
  title: string
  description: string
  starterCode: string
}

export const LAB_COUNT = 5

export const labConfigs: Record<number, LabConfig> = {
  1: {
    id: 1,
    title: 'Lab 1: ALU and Data Transfer Instructions',
    description:
      'Array A[] is stored in memory starting at address 0x2000 (each element is 4 bytes).\n' +
      'A[0] and A[1] are given. Compute:\n' +
      '  {A[3], A[2]} = A[1] * A[0]  (unsigned 64-bit multiply)\n' +
      '  A[4] = A[2] / 230            (signed divide)\n' +
      '  a    = A[2] % 230            (signed remainder)\n' +
      '  b = (char)(a >> 16),  c = (char)(a & 8),  d = (short)(a << 2)\n' +
      '  A[5] = {b, c, d}             (b=bits 31-24, c=bits 23-16, d=bits 15-0)\n\n' +
      'Submit to test all 3 graded cases.',
    starterCode: `; Lab 1: ALU and Data Transfer Instructions
; Array A[] is at base address 0x2000
;   A[0] = [0x2000], A[1] = [0x2004], A[2] = [0x2008]
;   A[3] = [0x200C], A[4] = [0x2010], A[5] = [0x2014]

MOV EBX, 0x00002000       ; EBX = base address of A[]

; Step 1: unsigned multiply {A[3], A[2]} = A[1] * A[0]
MOV EAX, [EBX]            ; EAX = A[0]
MOV ECX, [EBX+4]          ; ECX = A[1]
MUL ECX                   ; EDX:EAX = EAX * ECX (unsigned)
MOV [EBX+8],  EAX         ; A[2] = low 32 bits
MOV [EBX+12], EDX         ; A[3] = high 32 bits

; Step 2: A[4] = A[2] / 230,  a (EDX) = A[2] % 230
MOV EAX, [EBX+8]          ; EAX = A[2]
CDQ                        ; sign-extend EAX into EDX:EAX
MOV ECX, 230
IDIV ECX                  ; EAX = quotient, EDX = remainder (a)
MOV [EBX+16], EAX         ; A[4]

; Step 3: b = (char)(a >> 16), c = (char)(a & 8), d = (short)(a << 2)
; EDX holds 'a' here
MOV EAX, EDX              ; EAX = a (for b)
SAR EAX, 16               ; arithmetic shift right 16
AND EAX, 0x000000FF       ; b = low byte (char truncation)
MOV ECX, EDX              ; ECX = a (for c)
AND ECX, 8                ; c = a & 8
MOV ESI, EDX              ; ESI = a (for d)
SHL ESI, 2                ; d = a << 2
AND ESI, 0x0000FFFF       ; d = short truncation

; Step 4: A[5] = {b, c, d} packed into 32 bits
SHL EAX, 24               ; b in bits 31-24
SHL ECX, 16               ; c in bits 23-16
OR  EAX, ECX
OR  EAX, ESI
MOV [EBX+20], EAX         ; A[5]
`,
  },
  2: {
    id: 2,
    title: 'Lab 2: Loops (Conditional and Unconditional Branch Instructions)',
    description:
      'Write an x86 program to remove all occurrences of a given element from an array.\n\n' +
      'Memory layout:\n' +
      '  [0x1F00] = n    (array length, update this after removal)\n' +
      '  [0x1F04] = val  (value to remove)\n' +
      '  Array A[] starts at address 0x2000 (each element is 4 bytes)\n\n' +
      'C pseudocode:\n' +
      '  int i = 0;\n' +
      '  while (i < n) {\n' +
      '    if (A[i] != val)\n' +
      '      i++;\n' +
      '    else {\n' +
      '      for (int k = i; k < n - 1; k++)\n' +
      '        A[k] = A[k+1];\n' +
      '      n = n - 1;\n' +
      '    }\n' +
      '  }\n\n' +
      'After execution, store the new n back to [0x1F00].\n' +
      'Only the first n elements of the array will be checked.\n\n' +
      'Grading: 4 automated tests (5 pts each) + 2 manual checks (5 pts each) = 30 pts.',
    starterCode: `; Lab 2: Loops - Remove element from array
; Memory layout:
;   [0x1F00] = n   (array length)
;   [0x1F04] = val (value to remove)
;   Array A[] at 0x2000: A[0]=[0x2000], A[1]=[0x2004], ...
;
; TODO: Implement the removal loop
;   1. Load n from [0x1F00], val from [0x1F04]
;   2. Loop through array, remove all occurrences of val
;      by shifting subsequent elements left
;   3. Store updated n back to [0x1F00]

; Load parameters
MOV ECX, [0x1F00]         ; ECX = n (array length)
MOV EDX, [0x1F04]         ; EDX = val (value to remove)
MOV EBX, 0x00002000       ; EBX = base address of A[]

; TODO: implement your removal loop here
;   Use CMP, JE/JNE, JL/JGE for comparisons and branches
;   Use JMP for unconditional jumps

; When done, store the new n
MOV [0x1F00], ECX         ; store updated n
`,
  },
  3: {
    id: 3,
    title: 'Lab 3: Single Procedure Call',
    description:
      'Given an array A of n1 integers, build a new array B where each element equals A[i] raised to the power i.\n\n' +
      'Your program must use CALL and RET to implement two helper procedures:\n' +
      '  - exponent: computes a base raised to an integer power using repeated multiplication (IMUL)\n' +
      '  - append: stores a computed value into the next available slot in array B\n\n' +
      'Steps to implement:\n' +
      '  1. Read n1 from memory and load the base addresses of A and B\n' +
      '  2. Handle the i=0 case (any number to the power 0 equals 1)\n' +
      '  3. Loop over the remaining elements, calling exponent then append for each\n' +
      '  4. Track and store the final length of B when done\n\n' +
      'Important: use PUSH and POP to preserve registers across each CALL, and\n' +
      'make sure execution does not fall through into your procedure bodies.\n\n' +
      'Memory layout:\n' +
      '  [0x1F00] = n1   (length of array A, read-only)\n' +
      '  Array A[] starts at 0x2000  (4 bytes per element)\n' +
      '  Array B[] starts at 0x3000  (4 bytes per element, write your results here)\n' +
      '  Store the final length of B at [0x1F04]\n\n' +
      'Grading: 4 automated tests (5 pts each) + 2 manual checks (5 pts each) = 30 pts.',
    starterCode: `; Lab 3: Single Procedure Call
; Memory layout:
;   [0x1F00] = n1  (array length)
;   Array A[] at 0x2000: A[0]=[0x2000], A[1]=[0x2004], ...
;   Array B[] at 0x3000: B[0]=[0x3000], B[1]=[0x3004], ...
;   Store result n2 at [0x1F04]
;
; Instructions available: CALL, RET, PUSH, POP, IMUL

; ── main ────────────────────────────────────
MOV ECX, [0x1F00]         ; ECX = n1 (array length)
MOV EBX, 0x00002000       ; EBX = base address of A[]
MOV EDI, 0x00003000       ; EDI = base address of B[]

; TODO: handle the i=0 base case, then loop over A[1]..A[n1-1]
;       calling exponent and append for each element.
;       Remember to preserve registers with PUSH/POP around each CALL.
;       Store the final length of B at [0x1F04] when done.

; ── exponent ────────────────────────────────
; TODO: implement exponent procedure
;   Decide which registers hold the base (x) and exponent (y)
;   Use IMUL in a loop to compute x^y, return result in EAX

; ── append ──────────────────────────────────
; TODO: implement append procedure
;   Compute the address of B[n2] and store the value there
`,
  },
  4: {
    id: 4,
    title: 'Lab 4: Nested Procedure Call – Linked List Insertion',
    description:
      'Write an x86 program to insert a given node into a linked list at a specified position, using Nested Procedure Calls.\n\n' +
      'Each node is 8 bytes in memory:\n' +
      '  [addr+0] = value  (4 bytes, signed integer)\n' +
      '  [addr+4] = next   (4 bytes, address of next node; 0 = NULL / last)\n\n' +
      'Register setup at program start:\n' +
      '  EBX = head    (address of first node)\n' +
      '  ESI = newNode (address of node to insert)\n' +
      '  ECX = n       (0=before 1st node, 1=after 1st, 2=after 2nd, ...)\n\n' +
      'Result: EAX = value of the newly inserted node\n\n' +
      'Implement three sections using CALL/RET (nested calls required):\n\n' +
      '  main\n' +
      '    calls addNode; result is in EAX\n\n' +
      '  addNode  (EBX=head, ECX=n, ESI=newNode -> EAX=newNode->value)\n' +
      '    if n==0: newNode->next=head, EBX=newNode, return newNode->value\n' +
      '    else: CALL findNode to get addr1 (EAX) and addr2 (EDX),\n' +
      '          addr1->next=newNode, newNode->next=addr2, return newNode->value\n\n' +
      '  findNode  (EBX=head, ECX=n -> EAX=addr1, EDX=addr2)\n' +
      '    traverse from head, stop at nth node or end of list\n' +
      '    return addr1 = nth node, addr2 = (n+1)th node (0 if end)\n\n' +
      'Use PUSH/POP to preserve registers across nested CALL/RET.\n\n' +
      'Grading: 4 automated tests (5 pts each) + 2 manual checks (5 pts each) = 30 pts.',
    starterCode: `; Lab 4: Nested Procedure Call - Linked List Node Insertion
; Each node is 8 bytes: [addr+0]=value (i32), [addr+4]=next (0=NULL)
;
; Register setup at start:
;   EBX = head    (address of first node)
;   ESI = newNode (address of node to insert)
;   ECX = n       (0=before 1st, 1=after 1st, 2=after 2nd, ...)
; Result: EAX = value of newly inserted node
;
; Call tree: main -> addNode -> findNode
; Use CALL/RET and PUSH/POP across all procedure calls.

; -- main ----------------------------------------------------------
CALL addNode          ; call addNode(EBX=head, ECX=n, ESI=newNode)
JMP lab4_end          ; EAX = value of newly inserted node

; -- addNode -------------------------------------------------------
; Inputs:  EBX=head, ECX=n, ESI=newNode
; Output:  EAX = newNode->value
addNode:
  CMP ECX, 0
  JNE addNode_else

  ; n == 0: insert newNode before the current head
  ; TODO: newNode->next = head,  EBX = newNode,  EAX = newNode->value
  RET

addNode_else:
  ; n > 0: find the nth node, then splice newNode in
  PUSH ESI             ; save newNode across the nested CALL
  CALL findNode        ; EAX = addr1 (nth node),  EDX = addr2 ((n+1)th)
  POP ESI              ; restore newNode

  ; TODO: addr1->next = newNode,  newNode->next = addr2,  EAX = newNode->value
  RET

; -- findNode ------------------------------------------------------
; Inputs:  EBX=head, ECX=n
; Output:  EAX=addr1 (nth node),  EDX=addr2 ((n+1)th node or 0)
findNode:
  MOV EAX, EBX        ; curr = head
  MOV EDI, 1          ; i = 1

findNode_loop:
  CMP EDI, ECX        ; if i >= n: stop
  JGE findNode_done
  MOV EDX, [EAX+4]    ; next = curr->next
  CMP EDX, 0          ; if next == NULL: end of list
  JE  findNode_done
  MOV EAX, EDX        ; curr = next
  ADD EDI, 1          ; i++
  JMP findNode_loop

findNode_done:
  MOV EDX, [EAX+4]    ; addr2 = curr->next
  RET

lab4_end:
`,
  },
  5: {
    id: 5,
    title: 'Lab 5: Recursive Procedure Call – Shift and Add Multiplication',
    description:
      'Compute the product of two 16-bit signed numbers using recursive procedure calls.\n' +
      'You may NOT use MUL or IMUL instructions.\n\n' +
      'Register setup at program start:\n' +
      '  EBX = multiplicand\n' +
      '  ECX = multiplier\n\n' +
      'Result:\n' +
      '  EAX = product  (EBX × ECX)\n' +
      '  EBX, ECX must be preserved (unchanged on return)\n\n' +
      'Implement two functions using CALL/RET:\n\n' +
      '  multiply  (EBX=md, ECX=m → EAX=product)\n' +
      '    Handle sign: if exactly one input is negative, negate the result.\n' +
      '    Convert both inputs to positive, then call recursion(p=0, md, m, n=16).\n\n' +
      '  recursion  (EAX=p, EBX=md, ECX=m, EDX=n → EAX=updated p)\n' +
      '    Base case: if n==0, return p.\n' +
      '    Recursive case (shift-and-add algorithm):\n' +
      '      if (m & 1) == 1: p += md\n' +
      '      m >>= 1  (SHR, logical right shift)\n' +
      '      md <<= 1 (SHL)\n' +
      '      n--\n' +
      '      PUSH EBX/ECX/EDX, CALL recursion, POP EDX/ECX/EBX\n\n' +
      'Grading: 4 automated tests (5 pts each) + 2 manual checks (5 pts each) = 30 pts.',
    starterCode: `; Lab 5: Recursive Procedure Call – Shift and Add Multiplication
; Register setup:
;   EBX = multiplicand   (preserved on return)
;   ECX = multiplier     (preserved on return)
; Result:
;   EAX = product (EBX * ECX)
;
; Call tree: [main] -> multiply -> recursion (recursive)
; Use CALL/RET and PUSH/POP. You may NOT use MUL or IMUL.

CALL multiply
JMP lab5_end

; -- multiply -------------------------------------------------------
; Inputs:  EBX=multiplicand, ECX=multiplier (both preserved)
; Output:  EAX = product
multiply:
  PUSH EBX              ; save original multiplicand
  PUSH ECX              ; save original multiplier

  ; TODO: determine sign_p (1 if exactly one input is negative, else 0)
  ;   Hint: use CMP and conditional jumps to check each register's sign

  ; TODO: make EBX and ECX positive (if negative, negate using SUB)
  ;   Hint: MOV ESI, 0 / SUB ESI, EBX / MOV EBX, ESI

  ; Call recursion(p=0, md=EBX, m=ECX, n=16)
  MOV EAX, 0            ; p = 0
  MOV EDX, 16           ; n = 16 (16-bit numbers)
  CALL recursion        ; EAX = product

  ; TODO: if sign_p == 1, negate EAX (negate product)

  POP ECX               ; restore original multiplier
  POP EBX               ; restore original multiplicand
  RET

lab5_end:
  JMP lab5_end          ; halt: loop forever so execution never falls into recursion

; -- recursion ------------------------------------------------------
; Inputs:  EAX=p, EBX=md, ECX=m, EDX=n
; Output:  EAX = updated product
; Base case:     n == 0 → return p unchanged
; Recursive case: shift-and-add one step, then recurse
recursion:
  CMP EDX, 0
  JE rec_done           ; base case: n == 0, return EAX as-is

  ; TODO: if LSB of m (ECX & 1) == 1, add md (EBX) to p (EAX)
  ;   Hint: MOV ESI, ECX / AND ESI, 1 / CMP ESI, 0 / JE rec_shift / ADD EAX, EBX

rec_shift:
  ; TODO: SHR ECX, 1    (m >>= 1, logical right shift)
  ; TODO: SHL EBX, 1    (md <<= 1)
  ; TODO: SUB EDX, 1    (n--)

  ; TODO: PUSH EBX / PUSH ECX / PUSH EDX
  ; TODO: CALL recursion
  ; TODO: POP EDX / POP ECX / POP EBX

rec_done:
  RET
`,
  },
}
