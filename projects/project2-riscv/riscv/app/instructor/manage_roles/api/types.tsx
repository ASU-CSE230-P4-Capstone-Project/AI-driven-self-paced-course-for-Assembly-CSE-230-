import { z } from "zod";

export const CourseMembershipRoleSchema = z.enum(["student", "ta", "instructor"]);

export const ManageRoleRequestSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  courseId: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/, "Course ID must be a 5-digit value"),
  role: CourseMembershipRoleSchema,
});

export const ManageRoleMembershipSchema = z.object({
  username: z.string(),
  courseId: z.string(),
  role: z.string(),
  previousRole: z.string().nullable().optional(),
});

export const ManageRoleResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  membership: ManageRoleMembershipSchema.optional(),
});

export type CourseMembershipRole = z.infer<typeof CourseMembershipRoleSchema>;
export type ManageRoleRequest = z.infer<typeof ManageRoleRequestSchema>;
export type ManageRoleMembership = z.infer<typeof ManageRoleMembershipSchema>;
export type ManageRoleResponse = z.infer<typeof ManageRoleResponseSchema>;
