import { z } from 'zod';

export const CourseLabRosterGradeEntrySchema = z.object({
  username: z.string(),
  asuid: z.string(),
  name: z.string(),
  grade: z.number(),
});

export const CourseLabRosterGradesResponseSchema = z.object({
  success: z.boolean(),
  labTitle: z.string().optional(),
  members: z.array(CourseLabRosterGradeEntrySchema).optional(),
  message: z.string().optional(),
});

export type CourseLabRosterGradeEntry = z.infer<typeof CourseLabRosterGradeEntrySchema>;
export type CourseLabRosterGradesResponse = z.infer<typeof CourseLabRosterGradesResponseSchema>;
