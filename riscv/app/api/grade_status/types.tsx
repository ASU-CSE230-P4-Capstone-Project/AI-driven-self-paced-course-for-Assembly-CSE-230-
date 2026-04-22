import { z } from 'zod';

// Schema for the grade status request
export const GradeStatusRequestSchema = z.object({
  course_id: z.string().length(5).regex(/^[0-9]{5}$/),
  lab_uid: z.string(),
});

export type GradeStatusRequest = z.infer<typeof GradeStatusRequestSchema>;

// Schema for the grade status response
export const GradeStatusResponseSchema = z.object({
  attemptsUsed: z.number().optional(),
  attemptsRemaining: z.number().optional(),
  attemptsLimit: z.number().optional(),
  error: z.string().optional(),
});

export type GradeStatusResponse = z.infer<typeof GradeStatusResponseSchema>;
