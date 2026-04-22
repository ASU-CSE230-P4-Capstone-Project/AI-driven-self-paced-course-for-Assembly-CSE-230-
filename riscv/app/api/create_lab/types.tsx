import { z } from 'zod';
import { LabSchema } from '@/app/api/list_labs/types';

// Schema for create lab request (only name parameter)
export const CreateLabRequestSchema = z.object({
  name: z.string().min(1, 'Lab name is required'),
});

export type CreateLabRequest = z.infer<typeof CreateLabRequestSchema>;

// Schema for create lab response
export const CreateLabResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  lab: LabSchema.optional(),
  error: z.string().optional(),
  details: z.any().optional(), // For validation error details
});

export type CreateLabResponse = z.infer<typeof CreateLabResponseSchema>;
