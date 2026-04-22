import { z } from 'zod';

export const StudentCourseSchema = z.object({
  course_id: z.string(),
  code: z.string(),
  title: z.string(),
  term: z.string().nullable(),
});

export const StudentCoursesResponseSchema = z.object({
  success: z.boolean(),
  courses: z.array(StudentCourseSchema).optional(),
  message: z.string().optional(),
});

export type StudentCourse = z.infer<typeof StudentCourseSchema>;
export type StudentCoursesResponse = z.infer<typeof StudentCoursesResponseSchema>;
