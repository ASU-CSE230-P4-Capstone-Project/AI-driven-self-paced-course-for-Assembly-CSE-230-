import { z } from 'zod';

export const LabSubmissionSchema = z.object({
  gradeSessionId: z.string(),
  grade: z.number(),
  passedTests: z.number().int(),
  totalTests: z.number().int(),
  passed: z.boolean(),
  errorMessage: z.string().nullable(),
  submittedCode: z.string(),
  submittedAt: z.string(),
});

export const SaveLabSubmissionRequestSchema = z.object({
  course_id: z.string().length(5).regex(/^[0-9]{5}$/),
  lab_uid: z.string().min(1),
  grade_session_id: z.string().min(1),
  code: z.string(),
  grade: z.number().min(0).max(100),
  passed_tests: z.number().int().min(0),
  total_tests: z.number().int().positive(),
  passed: z.boolean(),
  error_message: z.string().nullable().optional(),
});

export const LabSubmissionsResponseSchema = z.object({
  success: z.boolean(),
  submissions: z.array(LabSubmissionSchema).optional(),
  submission: LabSubmissionSchema.optional(),
  message: z.string().optional(),
});

export type LabSubmission = z.infer<typeof LabSubmissionSchema>;
export type SaveLabSubmissionRequest = z.infer<typeof SaveLabSubmissionRequestSchema>;
export type LabSubmissionsResponse = z.infer<typeof LabSubmissionsResponseSchema>;
