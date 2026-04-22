import { z } from 'zod';

// Schema for create test case request
export const CreateTestCaseRequestSchema = z.object({
  lab_uid: z.string().min(1, 'Lab UID is required'),
  name: z.string().min(1, 'Test case name is required'),
});

export type CreateTestCaseRequest = z.infer<typeof CreateTestCaseRequestSchema>;

// Schema for a test case
export const TestCaseSchema = z.object({
  uid: z.string(),
  lab_uid: z.string(),
  name: z.string(),
  seed_registers: z.string(),
  seed_memory: z.string(),
  result_registers: z.string(),
  result_memory: z.string(),
});

export type TestCase = z.infer<typeof TestCaseSchema>;

// Schema for create test case response
export const CreateTestCaseResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  testCase: TestCaseSchema.optional(),
  error: z.string().optional(),
  details: z.any().optional(),
});

export type CreateTestCaseResponse = z.infer<typeof CreateTestCaseResponseSchema>;
