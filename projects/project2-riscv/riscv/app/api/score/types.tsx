import { z } from 'zod';

// Schema for the score request
export const ScoreRequestSchema = z.object({
  code: z.string(),
  course_id: z.string().length(5).regex(/^[0-9]{5}$/),
  test_uid: z.string(),
  grade_session_id: z.string().optional(),
});

export type ScoreRequest = z.infer<typeof ScoreRequestSchema>;

// Schema for the score response
export const ScoreResponseSchema = z.object({
  pass: z.boolean(),
  error: z.string().optional(),
  attemptsUsed: z.number().optional(),
  attemptsRemaining: z.number().optional(),
  attemptsLimit: z.number().optional(),
});

export type ScoreResponse = z.infer<typeof ScoreResponseSchema>;
