import { z } from "zod";

export const UserSearchRequestSchema = z.object({
  query: z.string().optional(),
  role: z.enum(["any", "student", "instructor", "ta"]).optional(),
  course: z.string().optional(),
});

export const UserSearchResultSchema = z.object({
  username: z.string(),
  asuid: z.string().nullable().optional(),
  instructor: z.boolean(),
  courseId: z.string().nullable().optional(),
  courseRole: z.string().nullable().optional(),
});

export const UserSearchResponseSchema = z.object({
  success: z.boolean(),
  users: z.array(UserSearchResultSchema).optional(),
  message: z.string().optional(),
});

export type UserSearchRequest = z.infer<typeof UserSearchRequestSchema>;
export type UserSearchResult = z.infer<typeof UserSearchResultSchema>;
export type UserSearchResponse = z.infer<typeof UserSearchResponseSchema>;
