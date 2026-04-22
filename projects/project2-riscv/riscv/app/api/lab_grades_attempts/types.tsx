import { z } from "zod";

export const LabGradesAttemptRowSchema = z.object({
  attemptNumber: z.number(),
  gradeSessionId: z.string(),
  gradedAt: z.string(),
  passedTests: z.number(),
  score: z.number(),
  maxScore: z.number(),
  totalTests: z.number(),
});

export const LabGradesAttemptsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  labUid: z.string(),
  memberUsername: z.string(),
  testCaseCount: z.number(),
  maxScore: z.number(),
  attempts: z.array(LabGradesAttemptRowSchema).optional(),
});

export type LabGradesAttemptRow = z.infer<typeof LabGradesAttemptRowSchema>;
export type LabGradesAttemptsResponse = z.infer<typeof LabGradesAttemptsResponseSchema>;
