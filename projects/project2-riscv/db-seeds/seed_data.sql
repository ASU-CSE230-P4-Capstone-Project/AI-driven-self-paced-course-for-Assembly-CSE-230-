-- =============================================================================
-- Legacy/dev seed bundle
-- =============================================================================
-- Idempotent: safe to rerun. Existing keyed rows are updated only when the seed
-- values changed; otherwise repeated runs become no-ops. Rows that are already
-- present under conflicting usernames/ASUIDs in the supplemental seed-user
-- block are skipped.
-- =============================================================================

INSERT INTO public.labs (uid, title, md)
VALUES
(
    '2025120316373801513aa03d83-8962-4322-a6f6-03aa9ffde273',
    'A smaller example',
    replace($lab_md_1$# A small example\n\nCompared to our comprehensive demo, this is a much smaller one that fully runs and can be graded!!!\n\n~~~\n# Example RV32I Program\n# Demonstrates: register initialization, forward jumps, and loops\n# ===== SECTION 1: Initialize registers =====\n# PC=0: Seed some register values\naddi x1, x0, 10      # x1 = 10\naddi x2, x0, 20      # x2 = 20\naddi x3, x0, 30      # x3 = 30\n\n# ===== SECTION 2: Forward jump over code =====\n# PC=3: Jump forward over the next 5 instructions\nbeq x0, x0, 5        # Always branch (x0 == x0), jump to PC=3+5=8\n\n# PC=4-7: These instructions will be SKIPPED\nadd x4, x1, x2       # SKIPPED: would set x4 = 10 + 20 = 30\nadd x5, x2, x3       # SKIPPED: would set x5 = 20 + 30 = 50\nadd x6, x1, x3       # SKIPPED: would set x6 = 10 + 30 = 40\nadd x7, x4, x5       # SKIPPED: would use uninitialized x4, x5\nadd x8, x6, x7       # SKIPPED: would use uninitialized x6, x7\n\n# PC=8: Landing point after jump\n# Verify jump worked by setting a marker register\naddi x10, x0, 99     # x10 = 99 (marker that we jumped correctly)\n\n# ===== SECTION 3: For loop =====\n# Goal: Add 2 to x30 for each iteration, x29 is the counter\n# Loop 5 times: x29 goes from 5 down to 0\n\n# PC=9: Initialize loop variables\naddi x29, x0, 5      # x29 = 5 (loop counter)\naddi x30, x0, 0      # x30 = 0 (accumulator)\n\n# PC=11: Loop body starts here\n# LOOP_START:\naddi x30, x30, 2     # x30 += 2\naddi x29, x29, -1    # x29 -= 1 (decrement counter)\n\n# PC=13: Loop condition check\nbne x29, x0, -2      # If x29 != 0, jump back 2 instructions to PC=11\n\n# PC=14: After loop completes\n# At this point:\n# - x30 should be 10 (5 iterations x 2)\n# - x29 should be 0\naddi x31, x0, 100    # x31 = 100 (marker that loop completed)\n\n# ===== EXPECTED FINAL REGISTER STATE =====\n# x0  = 0   (always zero)\n# x1  = 10  (initialized in section 1)\n# x2  = 20  (initialized in section 1)\n# x3  = 30  (initialized in section 1)\n# x4  = 0   (never set - skipped by jump)\n# x5  = 0   (never set - skipped by jump)\n# x6  = 0   (never set - skipped by jump)\n# x7  = 0   (never set - skipped by jump)\n# x8  = 0   (never set - skipped by jump)\n# x9  = 0   (never used)\n# x10 = 99  (marker - proves jump worked)\n# x11-x28 = 0 (never used)\n# x29 = 0   (loop counter - finished at 0)\n# x30 = 10  (accumulator - 5 iterations x 2 = 10)\n# x31 = 100 (marker - proves loop completed)\n\n~~~$lab_md_1$, '\n', E'\n')
),
(
    '202512031635030656c5830d1a-8aef-45e4-b062-4b7c1c5531f4',
    'Comprehensive Test',
    replace($lab_md_2$# Comprehensive Test\n\nIn here is a pretty comprehensive test of all of our instructions, with an associated test case!\n\n~~~\n# Comprehensive RV32I Instruction Test Program\n# Tests ALL implemented instructions including memory operations\n\n# ===== MEMORY STORE SECTION =====\n# Store values 0-10 in memory addresses 0x0 to 0x28 (0, 4, 8, ..., 40)\naddi x1, x0, 0       # x1 = 0 (value to store)\naddi x2, x0, 0       # x2 = 0 (base address)\n\nsw x1, x2, 0         # memory[0] = 0\naddi x1, x1, 1       # x1 = 1\nsw x1, x2, 4         # memory[4] = 1\naddi x1, x1, 1       # x1 = 2\nsw x1, x2, 8         # memory[8] = 2\naddi x1, x1, 1       # x1 = 3\nsw x1, x2, 12        # memory[12] = 3\naddi x1, x1, 1       # x1 = 4\nsw x1, x2, 16        # memory[16] = 4\naddi x1, x1, 1       # x1 = 5\nsw x1, x2, 20        # memory[20] = 5\naddi x1, x1, 1       # x1 = 6\nsw x1, x2, 24        # memory[24] = 6\naddi x1, x1, 1       # x1 = 7\nsw x1, x2, 28        # memory[28] = 7\naddi x1, x1, 1       # x1 = 8\nsw x1, x2, 32        # memory[32] = 8\naddi x1, x1, 1       # x1 = 9\nsw x1, x2, 36        # memory[36] = 9\naddi x1, x1, 1       # x1 = 10\nsw x1, x2, 40        # memory[40] = 10\n\n# ===== ARITHMETIC INSTRUCTIONS =====\naddi x3, x0, 100     # x3 = 100\naddi x4, x0, 50      # x4 = 50\nadd x5, x3, x4       # x5 = 100 + 50 = 150\nsub x6, x3, x4       # x6 = 100 - 50 = 50\n\n# ===== LOGICAL INSTRUCTIONS =====\naddi x7, x0, 0xFF    # x7 = 255 (0b11111111)\naddi x8, x0, 0x0F    # x8 = 15  (0b00001111)\n\nand x9, x7, x8       # x9 = 255 & 15 = 15\nandi x10, x7, 0x0F   # x10 = 255 & 15 = 15\nor x11, x7, x8       # x11 = 255 | 15 = 255\nori x12, x8, 0xF0    # x12 = 15 | 240 = 255\nxor x13, x7, x8      # x13 = 255 ^ 15 = 240\nxori x14, x7, 0x0F   # x14 = 255 ^ 15 = 240\n\n# ===== SHIFT INSTRUCTIONS =====\naddi x15, x0, 8      # x15 = 8\naddi x16, x0, 2      # x16 = 2 (shift amount)\n\nsll x17, x15, x16    # x17 = 8 << 2 = 32\nslli x18, x15, 2     # x18 = 8 << 2 = 32\nsrl x19, x17, x16    # x19 = 32 >> 2 = 8 (logical)\nsrli x20, x17, 2     # x20 = 32 >> 2 = 8\n\naddi x21, x0, -8     # x21 = -8\nsra x22, x21, x16    # x22 = -8 >> 2 = -2 (arithmetic)\nsrai x23, x21, 2     # x23 = -8 >> 2 = -2\n\n# ===== COMPARISON INSTRUCTIONS =====\naddi x24, x0, -5     # x24 = -5\naddi x25, x0, 10     # x25 = 10\nslt x26, x24, x25    # x26 = 1 (-5 < 10, signed)\nslti x27, x24, 10    # x27 = 1 (-5 < 10, signed)\n\n# ===== BRANCH INSTRUCTIONS =====\n# BEQ test\naddi x28, x0, 5\naddi x29, x0, 5\nbeq x28, x29, 1      # Equal, skip next\naddi x30, x0, 99     # SKIPPED\naddi x30, x0, 1      # x30 = 1\n\n# BNE test\naddi x28, x0, 5\naddi x29, x0, 10\nbne x28, x29, 1      # Not equal, skip next\naddi x30, x0, 99     # SKIPPED\naddi x30, x0, 2      # x30 = 2\n\n# BLT test (signed)\naddi x28, x0, -5\naddi x29, x0, 10\nblt x28, x29, 1      # -5 < 10, skip next\naddi x30, x0, 99     # SKIPPED\naddi x30, x0, 3      # x30 = 3\n\n# BGE test (signed)\naddi x28, x0, 10\naddi x29, x0, -5\nbge x28, x29, 1      # 10 >= -5, skip next\naddi x30, x0, 99     # SKIPPED\naddi x30, x0, 4      # x30 = 4\n\n# BLTU test (unsigned)\naddi x28, x0, 5\naddi x29, x0, 10\nbltu x28, x29, 1     # 5 < 10, skip next\naddi x30, x0, 99     # SKIPPED\naddi x30, x0, 5      # x30 = 5\n\n# BGEU test (unsigned)\naddi x28, x0, 10\naddi x29, x0, 5\nbgeu x28, x29, 1     # 10 >= 5, skip next\naddi x30, x0, 99     # SKIPPED\naddi x30, x0, 6      # x30 = 6\n\n# ===== MEMORY LOAD SECTION =====\n# Load back some values we stored\naddi x2, x0, 0       # x2 = 0 (base address)\nlw x1, x2, 0         # x1 = memory[0] = 0\nlw x28, x2, 20       # x28 = memory[20] = 5\nlw x29, x2, 40       # x29 = memory[40] = 10\n\n# ===== FINAL MARKER =====\naddi x31, x0, 255    # x31 = 255 (completion marker)\n\n# ===== EXPECTED FINAL REGISTER STATE =====\n# x0  = 0     (always zero)\n# x1  = 0     (LW from memory[0])\n# x2  = 0     (base address for memory ops)\n# x3  = 100   (arithmetic test)\n# x4  = 50    (arithmetic test)\n# x5  = 150   (ADD: 100 + 50)\n# x6  = 50    (SUB: 100 - 50)\n# x7  = 255   (logical ops test value)\n# x8  = 15    (logical ops test value)\n# x9  = 15    (AND: 255 & 15)\n# x10 = 15    (ANDI: 255 & 15)\n# x11 = 255   (OR: 255 | 15)\n# x12 = 255   (ORI: 15 | 240)\n# x13 = 240   (XOR: 255 ^ 15)\n# x14 = 240   (XORI: 255 ^ 15)\n# x15 = 8     (shift test value)\n# x16 = 2     (shift amount)\n# x17 = 32    (SLL: 8 << 2)\n# x18 = 32    (SLLI: 8 << 2)\n# x19 = 8     (SRL: 32 >> 2)\n# x20 = 8     (SRLI: 32 >> 2)\n# x21 = 4294967288 (-8 as unsigned)\n# x22 = 4294967294 (-2 as unsigned, SRA: -8 >> 2)\n# x23 = 4294967294 (-2 as unsigned, SRAI: -8 >> 2)\n# x24 = 4294967291 (-5 as unsigned)\n# x25 = 10    (comparison test)\n# x26 = 1     (SLT: -5 < 10 signed)\n# x27 = 1     (SLTI: -5 < 10 signed)\n# x28 = 5     (LW from memory[20])\n# x29 = 10    (LW from memory[40])\n# x30 = 6     (final branch test marker)\n# x31 = 255   (completion marker)\n\n# ===== EXPECTED MEMORY STATE (first 44 bytes) =====\n# memory[0-3]   = 0  (little-endian: 00 00 00 00)\n# memory[4-7]   = 1  (little-endian: 01 00 00 00)\n# memory[8-11]  = 2  (little-endian: 02 00 00 00)\n# memory[12-15] = 3  (little-endian: 03 00 00 00)\n# memory[16-19] = 4  (little-endian: 04 00 00 00)\n# memory[20-23] = 5  (little-endian: 05 00 00 00)\n# memory[24-27] = 6  (little-endian: 06 00 00 00)\n# memory[28-31] = 7  (little-endian: 07 00 00 00)\n# memory[32-35] = 8  (little-endian: 08 00 00 00)\n# memory[36-39] = 9  (little-endian: 09 00 00 00)\n# memory[40-43] = 10 (little-endian: 0A 00 00 00)\n\n\n\n\n\n\n\n\n\n\n\n\n\n~~~$lab_md_2$, '\n', E'\n')
)
ON CONFLICT (uid) DO UPDATE
SET title = EXCLUDED.title,
    md = EXCLUDED.md
WHERE public.labs.title IS DISTINCT FROM EXCLUDED.title
   OR public.labs.md IS DISTINCT FROM EXCLUDED.md;

INSERT INTO public.secrets (name, value)
VALUES
('hmac', $secret_hmac$FYqCDN07YW74MitmBjkSx5zWw26uuTpGiGzY3kk5_chRR4ss_ePhrbmdIXeQnV06Mp4jr7SY23t6dll45mAHeU5GedbAzcnouE_Wr_9n-hi-enOzUp9CzZNuspz9V0VZIaF8KVHWg4ZpJjqskxpwJ9r9UU7y4RFU1vIAZZXpQdcJT2lUo3Q833p6rUCqj-yDbDNWL5VavTUJWROKq6CLFxE03o0bXLKdBMrK5emGUj3PgizLP5RtP2eZbdTLihqZHaWFCD_L1mE36bzxo8Yx2qDH1MznrY0Vvz1tJACq2LkObto6S-Pt2g0Fozt1KYzG6DwnUVYtP9Lk-5OgTGUbjyEkVDeDWXqbAOWtGgGBCBjUm1ur7AIApxwePufFMosDtSHhE9nuN071UZ_zUFHwaFbBpTOhl5-FhDcnkTWSD9OhFOa0Xn3lbQN80H-fCV39ipDZ1_1Y9XQLHyRx-uOixTYbXFdLN1y-eR8PCUF9M4uDES50GsDEaw1CFALDMjEINCHFiH9IRF_zKS--Vceyko5sybl9vwfV_EYA3W3e8uS2N0FwXBUk3iw4UZPCzqEyvU2Mi4EBmBbYrpXqn53Dqy08N3EY1DwpUDdEltJeURfWa8hbGCwbrTDHSe1y-QOWE5RqCCXxKGSnUktp9fw99TrI-Quga0arhpE--fU75Xs6fHfo_ZK2VjcFIfDj45MUUwxgo4bSau3uRYSJ0G3k86Gwsc5oqj3_ONwLteZSEEAgh2d64OavK4k_rziJP7_n1EWDVBWwUst4-BNLm0qZY-jufe57bAnRP3sU8VKXO_UqZfjAzk3K5_FCi7YKPuD3d15Qn_WBT743DIAH8sJO7OroFN7sgcOSMMTlaLosJGfs47YEeYzlC9JLPWkWsBPVWumH9El6Ni_i43Lu9I3Gsv6ZtKpc0_YWMN8lpkW-UVnmuonaUy3swPAYjVdxLKZk5xGkNtpQ4Nm0u6hIZx1l-B7QIFwHAp0PVxNy6sWMMKoy_z4G9tLSdJhJYfg4X9bNYKreZX3V1zq_KVP63A2xbCIaHGIAKJbjfyCCP_aZW1Jh10kwAurxyRoTm3OXjFyMiepvFcEQFkofpZjFYH7PS5tB5ilIcJlQ_pa6V0ESv8FYb3dt-6r67nhdTop0vKlKSpCiMXDPRm3ziM70q0HnG_l7Kcs1INgVhDdvNQKz3GE8So3q54QvwgMjQCsSuX7v-wJny5LsfLMK_bfdOJECXfy9kBoLJCcqSfNjqpC5K4Q1CJxGHSS_E8GViwJ6CA8tW8JNsjAp95XAMjEq8j7tbkaDDeKFKKkqe0TAyAO69moJHjzKwO8TZ1pM-KRAt8S1Xey1Oz_iW1Pirf00RITU5-b9TzCClr6HywP14Ka7K280MKuWZ87i8WRNtLUBN9IGQnB2d6wkBqc4Q8yvaPQqfXUGT4Yyu4-HOgfvROf86d_XI_77OiyJIVwL3DTyhNrZN30_4NcSUUsAwnVN4n_RY5p7S06lsa4MV8DvW0uj83KRMgC1JOrZM8spJvrN14q8L0cm_FNAGlwVRZbczIdYTBodXq4NlXaCp1rRfk31lzGClyNdqOPXAaCcFQxRkQaeMQndXGBnY9uj6LnIkZFEMvfL6tQSlwZon4-UujG_B2of_R8vEQ5gwMES94HHwDxpXfbeHW5Ut6KMP_S1d7p9SUdMH6BiH_tvEuwedgvvShjhFKtyG5tQpmpzUvZVfq9PjSfsZQ8Az_QY2sS088aInZ7BU8salPXdcvPR6rYgFtmWsCnHifyfgewEpqjv_uWmL57pbbJ8JfyGxuVy0BGb1A2aM6q1Fq9zXLaU5KTOHXdVE_8P-FtHp-7cOCoxVkvL_HVv1QykYYxBdiNe3RQfuJs-UHLc3ymdyL5MYwPE5rWVlaOzHDmSgzdF0gyHX18M_8A0S_REvYh-6uGY_jP5_Y4xy6X104cGj-HtjmLJAwwpXzosGN34bg_HfE5yxxpP_9q5ZCUKs4S1Ru7N$secret_hmac$)
ON CONFLICT (name) DO UPDATE
SET value = EXCLUDED.value
WHERE public.secrets.value IS DISTINCT FROM EXCLUDED.value;

INSERT INTO public.test_cases (uid, lab_uid, name, seed_registers, seed_memory, result_registers, result_memory)
VALUES
(
    '20251203164502071003b2091b-7d66-4edd-bcf3-67dc506c9ad4',
    '202512031635030656c5830d1a-8aef-45e4-b062-4b7c1c5531f4',
    'Main Test',
    '{}',
    '{}',
    '{"x3":"0x64"}',
    '{}'
),
(
    '2025120316400708111bc40230-ef12-4f05-a742-1045ad33033b',
    '2025120316373801513aa03d83-8962-4322-a6f6-03aa9ffde273',
    'Main Test!',
    '{}',
    '{}',
    '{"x3":"0x1e"}',
    '{}'
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


---------------------------------------------------------------------------
-- ALL SEEDS BELOW HAVE PASSWORD: 
--teacher password is teacher
--student password is student
---------------------------------------------------------------------------
INSERT INTO public.users (username, asuid, salt, password_hash, instructor)
VALUES
(
    'student',
    '1212345678',
    '145469c483160bae1100131e18215ff2f805d48948fb8276e06592e3a31f255dd85568ac4b12999d35859c92efd7dcb9e77935f4485afd2afda76aa83048ae7edee59559a8bd6043daed12695579828a88ed7afd28135b4f847df54283e84bb58faad741ee392643ae1e80a34aff18e1f963d9cc080906296f7cfc11b4940d7bb7fcdcd1988c03a582068689095195ef52fdf6156f041c79b3cdb7cd20fc442c8f3c46d85278891f2fa97e945ea692b416e924b020a2746ad49d86317a524866cf143e792cc4a26fe2f87d323b85d4c240cbc599d93887e667b366522823c475c630820a03cfdac586a56aac86e5a8b15ca80532a2d5145e6613ac5dcac2fc995ff1dc02b54bd244d6725f191183e91d9e2342a7efe5fa247c09fd74aa96c2e82a108672264fcf8ecac01333b35b153b502c9cafb656fa75e5b62a9b1fce7ac6cc2157aa925f4da6b5af7976e6106319ecf2945169d3f4bca8fdcb5d0ce1a6172f08d5de6973b3d5bbc587a439dc2980f8de8c211cf372e702f6755edcaaa5c8b4071f20377b38f45c1fc3a3899d4d17424ba7c7fadcc3476341e8f9ca69c1f18563f50d599fcaf9c3a6b3db91e91d5ca9eefec1d759bd2819c4c9d79368d2c8675ef936b1abbb26da1a45fd6e69b6caaa00433456336a7482d6f54dc71de47be8b707d43037852fbf844a5e7ef2c36c65f0e59da363402a23a90c0814f8f3abf54b86f6597aaedc67dbe994a46bda85d519e4e19630b7c70890ffef7bf5a4db1ddd95e38f164075e8244ffac0b0cb51bae568e17507fe593cde487d2237147631e60e3e967bd9bad6f3b33254611057cb208a5ab454fd5c2ceb84a20eecafe81cdaba6a5c0213ae7f5c527902363b40d0f623128f653bc43d48a8bb54df197ceaf60df42ff5602fc9a8cdf16ab62a2631637b0a62f23ebb5ca619e15dd540497d11da3b31634020c3656e4af893b39a8e43817bb041b1d3a586529f6080b3510165c11546c441c87a508756943b06c27adf497e58def89fb8348b7da867aff09c175dd07f15e46acff46d20b694ae48e7e7034a798a5d3a7e6d9a38108d09005c1ee7e2d3881f191fbc5601f45b8fe4abd73318c81047363cf0e3c58a8a40bb06c16c9988150946921154404391fab4980b8d736070a9b7e02ee72406967decb166bbc716d447ee194f50e3b146fc1f1dbb2cbe44bdf490a113952f7cfd4fc37f8b6c5de1dc626aebea9faf96eb4448f473c191244934ffa6c37e57fa463a185e1e793371ef675b5afb37d652b8eac544c5f5a58bb6d4d0c161744ef0715b006e4ba7378ca3df9c55ab9a7fec3389e4f6d302cabc8d510b0d7d469b2c82b82afef5e531212ad845ae6df989624e82ae6dc40dfd22f1e14a50ea479f5c8450164c7b680f2155b834',
    '$argon2id$v=19$m=65536,t=3,p=4$2jkHjM7xBdTNWFaJrJEg/g$rA6zrxG3jt4Mm7+P+rRlSVhUuiqjqfk6lLZ1dH09lGE',
    false
),
(
    'teacher',
    '1212345679',
    'b6f8cf624521d0d2cfbdf8ecb27a5eeba0c506c5de0cb6558ddcba46d3f73a50b0eef3eaf1bd65ad3e1456607e792a03b6460580b2f26cc14944d3eb3dbdbc91c846380977d6c6ef6aab24da797e24cbdffdf600474ce1c6dd0eb3482b36ee31a393352d26feea4c39fb5d5396669c7af167bb49c8e7435984cb4d36ceb3c1ed95283aecd93ef49b9d3811c5264b447b787959b00284b5d294d2d88eca4b9374ea7c4b85fe2cef083a4eb4df2519ec0f34de968678b834d804963ad13548f9d20374f96362673902e9f0fb3359bc036f122589525cd8904cc0183b87209f49aae24b8b8ef82e739a1eb15d11f9dcf044b2c026beea7c43e549e85f1b8e00e561bfaa2a2f52a9e315f6c8ba93191ed22343d1a34660b9832eb7766b7c56d9ee34bd5e0fa9c7d89ea5b3b2a5e70e478fde634975db959e10a798df0872a94eec989813343e24e11904df29af7828eb77a3dac154284bcb48e5cc89878bd574d7afc55c1866c22c26f48d60f1b37867036e6348a062d3963083fecaf14c1e8047a509ed7a0a828da9410396a2c1d65caabb3169b68540321c98546d02982bbbf1f2c037fb3256483a2c3f468ab792129ad5934adaac90b3c338611c9e048d0cdf2357c37d6ed4e5deecc0715130a42325f9d64f16feff1100a33fc3a97d289acf44e7ea46b2671cfdb35ac2e4e7365f1d250402747cfc00f37cb82411d95f8add6ace0aa9bedcee69e8cbe1ca980e8e1055da04ee9d4df78d0568e0732d0d105d991528da2d8f2f83e03c95f7084ad313b97058a5eab74b7d1c6c6431bb6522f3a0997bdf87d16656e9c53d7de1882fd5018d1556ac988349a75b6f2acab7750222ee599d2b732732e7eb6c96d91c238228d7d7be7a44dc5fc0811381a99d3b64d158c3d9a24e7eaf001e74598db8113b0171ad09b7389449232217d3c1e50ed20474bc5aa10e2723a810a110088c5dd19c6806b7b09743bf22c01a2efef0d9b08e561a4a4e8bcbe6a6f7b2a0c26ff82f0d57ded20d5128cdc417f70165bf78e590a3ee01f5b3e3994d7f174b67b17db630c6ff1427c994207989008ee2bde7f415e864064033aad472df5e1c81331e2fb99b51c11b91e40227c9b56dd30d79d230c2a3978fa7d705048af28aab9e537c721d38e8ecc2699b96f516f7f6b7b2ac2842f3fcbf86c8fbae7f02b80be98c6ab5c04d9a7f4f998f051bc9912bcabe40482c6ad2f13c256f56f0d7cca11c682d4a9f86ceb9659dd0a77caee11c46dbf2ca07785086b7d5b4fff105fdd11e5ad9a8baaf37536bf93ffba51392f52d9a02205f1147b858eb0b6839e2e95b41f222b6e2ba8509e8e3a99e1d97644451c697931fd6dd03af2fa4e4a9b3c685f84e2ac8981cccd083fab561b79fb2d14fe14bdd15fe0650ce847aee',
    '$argon2id$v=19$m=65536,t=3,p=4$vc6u4uXdkyQ+mnwiNxzc/A$Ik2KS8CNy+3CaVFINmKPQcYJikjiBMZJMOBMeSPm1Hs',
    true
)
ON CONFLICT (username) DO UPDATE
SET asuid = EXCLUDED.asuid,
    salt = EXCLUDED.salt,
    password_hash = EXCLUDED.password_hash,
    instructor = EXCLUDED.instructor
WHERE public.users.asuid IS DISTINCT FROM EXCLUDED.asuid
   OR public.users.salt IS DISTINCT FROM EXCLUDED.salt
   OR public.users.password_hash IS DISTINCT FROM EXCLUDED.password_hash
   OR public.users.instructor IS DISTINCT FROM EXCLUDED.instructor;



---------------------------------------------------------------------------
-- ALL SEEDS BELOW HAVE PASSWORD: ta123456
---------------------------------------------------------------------------
WITH seed_users (username, asuid, instructor, salt, password_hash) AS (
    VALUES
        ('instructor_seed', '1219000001', true,  'seed_salt', '$argon2id$v=19$m=65536,t=3,p=4$MDWUiQd/aYY3aWDHyAQUTA$zH08wsnPASz/Jl0Mky4SUfJaMJyHARUKzrWyMg2+/90'),
        ('ta_alex',         '1219000101', false, 'seed_salt', '$argon2id$v=19$m=65536,t=3,p=4$MDWUiQd/aYY3aWDHyAQUTA$zH08wsnPASz/Jl0Mky4SUfJaMJyHARUKzrWyMg2+/90'),
        ('ta_briana',       '1219000102', false, 'seed_salt', '$argon2id$v=19$m=65536,t=3,p=4$MDWUiQd/aYY3aWDHyAQUTA$zH08wsnPASz/Jl0Mky4SUfJaMJyHARUKzrWyMg2+/90'),
        ('ta_chris',        '1219000103', false, 'seed_salt', '$argon2id$v=19$m=65536,t=3,p=4$MDWUiQd/aYY3aWDHyAQUTA$zH08wsnPASz/Jl0Mky4SUfJaMJyHARUKzrWyMg2+/90'),
        ('student_seed_1',  '1219000201', false, 'seed_salt', '$argon2id$v=19$m=65536,t=3,p=4$MDWUiQd/aYY3aWDHyAQUTA$zH08wsnPASz/Jl0Mky4SUfJaMJyHARUKzrWyMg2+/90'),
        ('student_seed_2',  '1219000202', false, 'seed_salt', '$argon2id$v=19$m=65536,t=3,p=4$MDWUiQd/aYY3aWDHyAQUTA$zH08wsnPASz/Jl0Mky4SUfJaMJyHARUKzrWyMg2+/90'),
        ('student_seed_3',  '1219000203', false, 'seed_salt', '$argon2id$v=19$m=65536,t=3,p=4$MDWUiQd/aYY3aWDHyAQUTA$zH08wsnPASz/Jl0Mky4SUfJaMJyHARUKzrWyMg2+/90')
),
eligible_users AS (
    SELECT su.*
    FROM seed_users su
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.username = su.username
           OR u.asuid = su.asuid
    )
)
INSERT INTO public.users (username, asuid, salt, password_hash, instructor)
SELECT username, asuid, salt, password_hash, instructor
FROM eligible_users
ON CONFLICT DO NOTHING;

-- Optional TA profile info
INSERT INTO public.ta_profiles (username, first_name, last_name, email, phone, office_location, active)
VALUES
    ('ta_alex',   'Alex',   'Nguyen', 'ta.alex@example.edu',   '480-555-0101', 'BYENG 210', true),
    ('ta_briana', 'Briana', 'Patel',  'ta.briana@example.edu', '480-555-0102', 'BYENG 212', true),
    ('ta_chris',  'Chris',  'Kim',    'ta.chris@example.edu',  '480-555-0103', 'BYENG 214', true)
ON CONFLICT (username) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    office_location = EXCLUDED.office_location,
    active = EXCLUDED.active,
    updated_at = now()
WHERE public.ta_profiles.first_name IS DISTINCT FROM EXCLUDED.first_name
   OR public.ta_profiles.last_name IS DISTINCT FROM EXCLUDED.last_name
   OR public.ta_profiles.email IS DISTINCT FROM EXCLUDED.email
   OR public.ta_profiles.phone IS DISTINCT FROM EXCLUDED.phone
   OR public.ta_profiles.office_location IS DISTINCT FROM EXCLUDED.office_location
   OR public.ta_profiles.active IS DISTINCT FROM EXCLUDED.active;

-- -------------------------------------------------------------------
-- 2) Seed courses
-- -------------------------------------------------------------------
INSERT INTO public.courses (course_id, code, title, term)
VALUES
    ('48501', 'CSE485', 'Capstone Project I', 'Spring 2026'),
    ('48502', 'CSE486', 'Capstone Project II', 'Spring 2026'),
    ('31001', 'CSE310', 'Data Structures and Algorithms', 'Spring 2026')
ON CONFLICT (course_id) DO UPDATE
SET code = EXCLUDED.code,
    title = EXCLUDED.title,
    term = EXCLUDED.term,
    updated_at = now()
WHERE public.courses.code IS DISTINCT FROM EXCLUDED.code
   OR public.courses.title IS DISTINCT FROM EXCLUDED.title
   OR public.courses.term IS DISTINCT FROM EXCLUDED.term;

-- -------------------------------------------------------------------
-- 3) Seed memberships (instructor / ta / student)
-- -------------------------------------------------------------------
INSERT INTO public.course_memberships (course_id, username, role, status, added_by, added_at)
VALUES
    -- instructors
    ('48501', 'instructor_seed', 'instructor', 'active', NULL, now()),
    ('48502', 'instructor_seed', 'instructor', 'active', NULL, now()),
    ('31001', 'instructor_seed', 'instructor', 'active', NULL, now()),

    -- TAs
    ('48501', 'ta_alex',   'ta', 'active', NULL, now()),
    ('48501', 'ta_briana', 'ta', 'active', NULL, now()),
    ('48502', 'ta_briana', 'ta', 'active', NULL, now()),
    ('31001', 'ta_chris',  'ta', 'active', NULL, now()),

    -- students
    ('48501', 'student_seed_1', 'student', 'active', NULL, now()),
    ('48501', 'student_seed_2', 'student', 'active', NULL, now()),
    ('48502', 'student_seed_2', 'student', 'active', NULL, now()),
    ('31001', 'student_seed_3', 'student', 'active', NULL, now())
ON CONFLICT (course_id, username) DO UPDATE
SET role = EXCLUDED.role,
    status = EXCLUDED.status,
    added_by = EXCLUDED.added_by
WHERE public.course_memberships.role IS DISTINCT FROM EXCLUDED.role
   OR public.course_memberships.status IS DISTINCT FROM EXCLUDED.status
   OR public.course_memberships.added_by IS DISTINCT FROM EXCLUDED.added_by;

-- -------------------------------------------------------------------
-- 4) Seed sections
-- -------------------------------------------------------------------
INSERT INTO public.course_sections (course_id, section_code, section_name)
VALUES
    ('48501', 'A', 'CSE485 Section A'),
    ('48501', 'B', 'CSE485 Section B'),
    ('48502', 'A', 'CSE486 Section A'),
    ('31001', 'A', 'CSE310 Section A'),
    ('31001', 'B', 'CSE310 Section B')
ON CONFLICT (course_id, section_code) DO UPDATE
SET section_name = EXCLUDED.section_name,
    updated_at = now()
WHERE public.course_sections.section_name IS DISTINCT FROM EXCLUDED.section_name;

-- -------------------------------------------------------------------
-- 5) Seed TA section assignments
--    (demonstrates one TA assigned to multiple sections)
-- -------------------------------------------------------------------
INSERT INTO public.ta_section_enrollments (section_id, ta_username, status, added_by, added_at)
SELECT
    cs.section_id,
    x.ta_username,
    'active' AS status,
    NULL AS added_by,
    now() AS added_at
FROM (
    VALUES
        ('48501', 'A', 'ta_alex'),
        ('48501', 'B', 'ta_alex'),   -- alex has multiple sections in same course
        ('48501', 'A', 'ta_briana'),
        ('48502', 'A', 'ta_briana'), -- briana spans multiple courses
        ('31001', 'A', 'ta_chris'),
        ('31001', 'B', 'ta_chris')   -- chris has multiple sections
) AS x(course_id, section_code, ta_username)
JOIN public.course_sections cs
  ON cs.course_id = x.course_id
 AND cs.section_code = x.section_code
ON CONFLICT (section_id, ta_username) DO UPDATE
SET status = EXCLUDED.status,
    added_by = EXCLUDED.added_by
WHERE public.ta_section_enrollments.status IS DISTINCT FROM EXCLUDED.status
   OR public.ta_section_enrollments.added_by IS DISTINCT FROM EXCLUDED.added_by;


-- Seed data for labs, secrets, test cases, and sample users (migrated from allinone.sql)
