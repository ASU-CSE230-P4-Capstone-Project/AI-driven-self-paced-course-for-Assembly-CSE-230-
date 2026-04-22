import { z } from 'zod';

export const LoginPortalSchema = z.enum(['student', 'admin']);

// Schema for the login request
export const LoginRequestSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  portal: LoginPortalSchema.optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginPortal = z.infer<typeof LoginPortalSchema>;

// Schema for the login response
export const LoginResponseSchema = z.object({
  username: z.string(),
  success: z.boolean(),
  student: z.boolean().optional(),
  instructor: z.boolean().optional(),
  ta: z.boolean().optional(),
  message: z.string().optional(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// Error response schema
export const ErrorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
