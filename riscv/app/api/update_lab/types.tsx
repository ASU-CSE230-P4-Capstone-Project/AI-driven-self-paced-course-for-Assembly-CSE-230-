import { z } from 'zod';
import { LabSchema } from '@/app/api/list_labs/types';

// Schema for the update lab response
export const UpdateLabResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  lab: LabSchema.optional(),
  error: z.string().optional(),
  details: z.any().optional(), // For validation error details
});

export type UpdateLabResponse = z.infer<typeof UpdateLabResponseSchema>;
