import { z } from 'zod';

export const RemoveCourseMemberRequestSchema = z.object({
  course_id: z.string().length(5).regex(/^[0-9]{5}$/),
  username: z.string().min(1),
});

export const RemoveCourseMemberResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type RemoveCourseMemberRequest = z.infer<typeof RemoveCourseMemberRequestSchema>;
export type RemoveCourseMemberResponse = z.infer<typeof RemoveCourseMemberResponseSchema>;
