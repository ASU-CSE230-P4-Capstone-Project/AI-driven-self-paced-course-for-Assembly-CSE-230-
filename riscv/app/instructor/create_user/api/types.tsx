import { z } from 'zod';
import {
  ASUID_INVALID_MESSAGE,
  ASUID_REGEX,
  ASUID_REQUIRED_MESSAGE,
} from '@/app/lib/asuid';

export const CreateUserRoleSchema = z.enum(["student", "ta", "instructor"]);

// Request schema
export const CreateUserRequestSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  asuid: z
    .string()
    .trim()
    .min(1, ASUID_REQUIRED_MESSAGE)
    .regex(ASUID_REGEX, ASUID_INVALID_MESSAGE),
  password: z.string().min(1, "Password is required"),
  role: CreateUserRoleSchema,
});

// Response schema
export const CreateUserResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// TypeScript types
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;
export type CreateUserRole = z.infer<typeof CreateUserRoleSchema>;
