import { z } from 'zod';
import type { AssemblyInfoData, SimState, SubmitResponse } from '@/components/types';

const LabSessionSchema = z.object({
  storageKey: z.string(),
  uid: z.string(),
  labUid: z.string().nullable().optional(),
  version: z.number().optional(),
  code: z.string(),
  resp: z.unknown().nullable(),
  simState: z.unknown().nullable(),
  stepIndex: z.number(),
  allStates: z.array(z.unknown()),
  registerOverrides: z.record(z.string(), z.string()),
  memoryOverrides: z.record(z.string(), z.string()),
});

export const SyncLabSessionRequestSchema = z.object({
  session: LabSessionSchema,
});

export type LabSession = {
  storageKey: string;
  uid: string;
  labUid?: string | null;
  version?: number;
  code: string;
  resp: AssemblyInfoData | null;
  simState: SimState | null;
  stepIndex: number;
  allStates: SubmitResponse["states"];
  registerOverrides: Record<string, string>;
  memoryOverrides: Record<string, string>;
};

export type SyncLabSessionRequest = {
  session: LabSession;
};

export const SyncLabSessionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type SyncLabSessionResponse = z.infer<typeof SyncLabSessionResponseSchema>;
