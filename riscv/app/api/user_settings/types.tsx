import { z } from 'zod';

export const UserSettingsSchema = z.object({
  editorFontSize: z.number().int().min(12).max(24),
  showHelpBubble: z.boolean(),
  openInstructionsByDefault: z.boolean(),
  warnBeforeReinstate: z.boolean(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  editorFontSize: 14,
  showHelpBubble: true,
  openInstructionsByDefault: true,
  warnBeforeReinstate: true,
};

export const UserSettingsResponseSchema = z.object({
  success: z.boolean(),
  settings: UserSettingsSchema.optional(),
  message: z.string().optional(),
});

export type UserSettingsResponse = z.infer<typeof UserSettingsResponseSchema>;
