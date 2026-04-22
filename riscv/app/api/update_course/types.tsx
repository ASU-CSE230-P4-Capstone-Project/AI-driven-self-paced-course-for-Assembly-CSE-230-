import { z } from 'zod';

export const UpdateCourseRequestSchema = z.object({
  course_id: z.string().length(5).regex(/^[0-9]{5}$/),
  code: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  term: z.string().optional(),
});

export const UpdateCourseResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type UpdateCourseRequest = z.infer<typeof UpdateCourseRequestSchema>;
export type UpdateCourseResponse = z.infer<typeof UpdateCourseResponseSchema>;
