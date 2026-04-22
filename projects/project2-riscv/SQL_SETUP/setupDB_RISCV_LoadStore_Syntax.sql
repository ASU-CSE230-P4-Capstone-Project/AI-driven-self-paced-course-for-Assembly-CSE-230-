-- Update the seeded comprehensive RISC-V lab to use canonical RV32I
-- load/store syntax without modifying the original seed/init SQL files.

DO $$
BEGIN
    IF to_regclass('public.labs') IS NULL THEN
        RAISE NOTICE '[setupDB_RISCV_LoadStore_Syntax] public.labs not found; skipping';
        RETURN;
    END IF;

    UPDATE public.labs
    SET md = replace(
               replace(
                 replace(
                   replace(
                     replace(
                       replace(
                         replace(
                           replace(
                             replace(
                               replace(
                                 replace(
                                   replace(
                                     replace(
                                       replace(
                                         md,
                                         'sw x1, x2, 0         # memory[0] = 0',
                                         'sw x1, 0(x2)         # memory[0] = 0'
                                       ),
                                       'sw x1, x2, 4         # memory[4] = 1',
                                       'sw x1, 4(x2)         # memory[4] = 1'
                                     ),
                                     'sw x1, x2, 8         # memory[8] = 2',
                                     'sw x1, 8(x2)         # memory[8] = 2'
                                   ),
                                   'sw x1, x2, 12        # memory[12] = 3',
                                   'sw x1, 12(x2)        # memory[12] = 3'
                                 ),
                                 'sw x1, x2, 16        # memory[16] = 4',
                                 'sw x1, 16(x2)        # memory[16] = 4'
                               ),
                               'sw x1, x2, 20        # memory[20] = 5',
                               'sw x1, 20(x2)        # memory[20] = 5'
                             ),
                             'sw x1, x2, 24        # memory[24] = 6',
                             'sw x1, 24(x2)        # memory[24] = 6'
                           ),
                           'sw x1, x2, 28        # memory[28] = 7',
                           'sw x1, 28(x2)        # memory[28] = 7'
                         ),
                         'sw x1, x2, 32        # memory[32] = 8',
                         'sw x1, 32(x2)        # memory[32] = 8'
                       ),
                       'sw x1, x2, 36        # memory[36] = 9',
                       'sw x1, 36(x2)        # memory[36] = 9'
                     ),
                     'sw x1, x2, 40        # memory[40] = 10',
                     'sw x1, 40(x2)        # memory[40] = 10'
                   ),
                   'lw x1, x2, 0         # x1 = memory[0] = 0',
                   'lw x1, 0(x2)         # x1 = memory[0] = 0'
                 ),
                 'lw x28, x2, 20       # x28 = memory[20] = 5',
                 'lw x28, 20(x2)       # x28 = memory[20] = 5'
               ),
               'lw x29, x2, 40       # x29 = memory[40] = 10',
               'lw x29, 40(x2)       # x29 = memory[40] = 10'
             )
    WHERE uid = '202512031635030656c5830d1a-8aef-45e4-b062-4b7c1c5531f4';

    RAISE NOTICE '[setupDB_RISCV_LoadStore_Syntax] Updated seeded comprehensive lab syntax, if present';
END $$;
