import { z } from 'zod';

export const CreateCourseRequestSchema = z.object({
  course_id: z.string().length(5, 'Course ID must be exactly 5 digits').regex(/^[0-9]{5}$/, 'Course ID must be 5 digits'),
  code: z.string().min(1, 'Course code is required'),
  title: z.string().min(1, 'Course title is required'),
  term: z.string().optional(),
});

export const CreateCourseResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type CreateCourseRequest = z.infer<typeof CreateCourseRequestSchema>;
export type CreateCourseResponse = z.infer<typeof CreateCourseResponseSchema>;
