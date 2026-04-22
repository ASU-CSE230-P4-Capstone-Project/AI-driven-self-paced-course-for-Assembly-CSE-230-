import { z } from 'zod';

// Schema for a single lab
export const LabSchema = z.object({
  uid: z.string(),
  title: z.string(),
  md: z.string(),
});

export type Lab = z.infer<typeof LabSchema>;

// Schema for the list labs response
export const ListLabsResponseSchema = z.object({
  success: z.boolean(),
  labs: z.array(LabSchema).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export type ListLabsResponse = z.infer<typeof ListLabsResponseSchema>;
