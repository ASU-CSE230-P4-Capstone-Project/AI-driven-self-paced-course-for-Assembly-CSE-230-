import { z } from 'zod';
import type { Workspace } from '@/components/types';

const ProjectStateSchema = z.object({
  code: z.string(),
  resp: z.unknown().nullable(),
  simState: z.unknown().nullable(),
  stepIndex: z.number(),
  allStates: z.array(z.unknown()),
  registerOverrides: z.record(z.string(), z.string()),
  memoryOverrides: z.record(z.string(), z.string()),
});

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  state: ProjectStateSchema,
});

export const WorkspaceSchema = z.object({
  uid: z.string(),
  currentProjectId: z.string().nullable(),
  projects: z.array(ProjectSchema),
});

export const LoadWorkspaceResponseSchema = z.object({
  success: z.boolean(),
  workspace: WorkspaceSchema.nullable().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type LoadWorkspaceResponse = {
  success: boolean;
  workspace?: Workspace | null;
  message?: string;
  error?: string;
};
