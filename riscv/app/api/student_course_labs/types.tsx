import { z } from 'zod';

export const StudentCourseLabSchema = z.object({
  uid: z.string(),
  title: z.string(),
  md: z.string(),
});

export const StudentCourseLabsResponseSchema = z.object({
  success: z.boolean(),
  labs: z.array(StudentCourseLabSchema).optional(),
  message: z.string().optional(),
});

export type StudentCourseLab = z.infer<typeof StudentCourseLabSchema>;
export type StudentCourseLabsResponse = z.infer<typeof StudentCourseLabsResponseSchema>;
