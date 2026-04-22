import { z } from "zod";
import {
  ASUID_INVALID_MESSAGE,
  ASUID_REGEX,
  ASUID_REQUIRED_MESSAGE,
} from "@/app/lib/asuid";

export const RegisterRequestSchema = z
  .object({
    username: z.string().trim().min(1, "Username is required"),
    asuid: z
      .string()
      .trim()
      .min(1, ASUID_REQUIRED_MESSAGE)
      .regex(ASUID_REGEX, ASUID_INVALID_MESSAGE),
    password: z.string().min(1, "Password is required"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const RegisterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
