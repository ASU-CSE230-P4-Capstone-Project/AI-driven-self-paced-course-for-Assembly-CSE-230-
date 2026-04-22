import { z } from 'zod';

export const GradeLabRequestSchema = z.object({
  code: z.string(),
  course_id: z.string().length(5).regex(/^[0-9]{5}$/),
  lab_uid: z.string().min(1),
  grade_session_id: z.string().optional(),
});

export type GradeLabRequest = z.infer<typeof GradeLabRequestSchema>;

export const GradeLabResponseSchema = z.object({
  pass: z.boolean(),
  grade: z.number().optional(),
  passedTests: z.number().optional(),
  totalTests: z.number().optional(),
  error: z.string().optional(),
  saveWarning: z.string().optional(),
  attemptsUsed: z.number().optional(),
  attemptsRemaining: z.number().optional(),
  attemptsLimit: z.number().optional(),
});

export type GradeLabResponse = z.infer<typeof GradeLabResponseSchema>;
