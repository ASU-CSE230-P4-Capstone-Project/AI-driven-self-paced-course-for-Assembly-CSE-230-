import { z } from 'zod';

// Schema for the sens object structure
export const SensDataSchema = z.object({
  hmac: z.string(),
  data: z.record(z.string(), z.unknown()), // Generic JSON object
});

export type SensData = z.infer<typeof SensDataSchema>;

// Schema for the verification request
export const VerifyRequestSchema = z.object({
  cookie: z.string(),
});

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

// Schema for the verification response
export const VerifyResponseSchema = z.object({
  cookie: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  reason: z
    .enum(['missing', 'invalid', 'expired', 'reauth_required'])
    .optional(),
});

export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
