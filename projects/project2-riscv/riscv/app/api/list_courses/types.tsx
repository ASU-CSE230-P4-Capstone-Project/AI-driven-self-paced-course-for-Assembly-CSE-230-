import { z } from 'zod';

export const CourseSchema = z.object({
  course_id: z.string(),
  code: z.string(),
  title: z.string(),
  term: z.string().nullable(),
});

export const ListCoursesResponseSchema = z.object({
  success: z.boolean(),
  courses: z.array(CourseSchema),
  message: z.string().optional(),
});

export type Course = z.infer<typeof CourseSchema>;
export type ListCoursesResponse = z.infer<typeof ListCoursesResponseSchema>;
