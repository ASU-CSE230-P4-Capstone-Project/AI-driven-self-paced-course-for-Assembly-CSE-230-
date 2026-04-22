import { z } from 'zod';

// Schema for delete test case request
export const DeleteTestCaseRequestSchema = z.object({
  uid: z.string().min(1, 'Test case UID is required'),
});

export type DeleteTestCaseRequest = z.infer<typeof DeleteTestCaseRequestSchema>;

// Schema for delete test case response
export const DeleteTestCaseResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type DeleteTestCaseResponse = z.infer<typeof DeleteTestCaseResponseSchema>;
