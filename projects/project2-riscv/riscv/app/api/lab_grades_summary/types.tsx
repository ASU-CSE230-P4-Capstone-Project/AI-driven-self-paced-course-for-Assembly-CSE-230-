import { z } from "zod";

export const LabGradesMemberSchema = z.object({
  username: z.string(),
  role: z.string(),
  attemptsUsed: z.number(),
  bestScore: z.number().nullable(),
});

export const LabGradesSummaryResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  testCaseCount: z.number(),
  maxScore: z.number(),
  members: z.array(LabGradesMemberSchema).optional(),
});

export type LabGradesSummaryResponse = z.infer<typeof LabGradesSummaryResponseSchema>;

