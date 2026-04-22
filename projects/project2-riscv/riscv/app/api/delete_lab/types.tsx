import { z } from 'zod';

// Schema for delete lab request (only uid parameter)
export const DeleteLabRequestSchema = z.object({
  uid: z.string().min(1, 'Lab UID is required'),
});

export type DeleteLabRequest = z.infer<typeof DeleteLabRequestSchema>;

// Schema for delete lab response
export const DeleteLabResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  details: z.any().optional(), // For validation error details
});

export type DeleteLabResponse = z.infer<typeof DeleteLabResponseSchema>;
