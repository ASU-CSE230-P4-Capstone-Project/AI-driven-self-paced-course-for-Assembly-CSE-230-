import { z } from 'zod';

export const CourseMemberSchema = z.object({
  username: z.string(),
  name: z.string().optional(),
  asuid: z.string().nullable().optional(),
  role: z.string(),
  status: z.string().optional(),
});

export const CourseMembersResponseSchema = z.object({
  success: z.boolean(),
  members: z.array(CourseMemberSchema).optional(),
  message: z.string().optional(),
});

export type CourseMember = z.infer<typeof CourseMemberSchema>;
export type CourseMembersResponse = z.infer<typeof CourseMembersResponseSchema>;
