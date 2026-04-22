import { z } from 'zod';

export const AddCourseMemberRequestSchema = z.object({
  course_id: z.string().trim().length(5).regex(/^[0-9]{5}$/),
  username: z.string().trim().min(1),
  role: z.enum(['student', 'instructor', 'ta']),
});

export const AddCourseMemberResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type AddCourseMemberRequest = z.infer<typeof AddCourseMemberRequestSchema>;
export type AddCourseMemberResponse = z.infer<typeof AddCourseMemberResponseSchema>;
