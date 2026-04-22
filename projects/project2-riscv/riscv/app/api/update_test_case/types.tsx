import { z } from 'zod';
import { TestCaseSchema } from '@/app/api/create_test_case/types';

// Schema for update test case request
export const UpdateTestCaseRequestSchema = z.object({
  uid: z.string().min(1, 'Test case UID is required'),
  name: z.string().min(1, 'Test case name is required').optional(),
  seed_registers: z.string().optional(),
  seed_memory: z.string().optional(),
  result_registers: z.string().optional(),
  result_memory: z.string().optional(),
});

export type UpdateTestCaseRequest = z.infer<typeof UpdateTestCaseRequestSchema>;

// Re-export TestCase type for convenience
export type { TestCase } from '@/app/api/create_test_case/types';

// Schema for update test case response
export const UpdateTestCaseResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  testCase: TestCaseSchema.optional(),
  error: z.string().optional(),
  details: z.any().optional(),
});

export type UpdateTestCaseResponse = z.infer<typeof UpdateTestCaseResponseSchema>;
