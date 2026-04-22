import { z } from 'zod';
import { TestCaseSchema } from '@/app/api/create_test_case/types';

// Schema for list test cases request
export const ListTestCasesRequestSchema = z.object({
  lab_uid: z.string().min(1, 'Lab UID is required'),
});

export type ListTestCasesRequest = z.infer<typeof ListTestCasesRequestSchema>;

// Re-export TestCase type for convenience
export type { TestCase } from '@/app/api/create_test_case/types';

// Schema for list test cases response
export const ListTestCasesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  testCases: z.array(TestCaseSchema).optional(),
  error: z.string().optional(),
});

export type ListTestCasesResponse = z.infer<typeof ListTestCasesResponseSchema>;
