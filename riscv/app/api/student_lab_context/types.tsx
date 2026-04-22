import { z } from 'zod';
import { LabSessionSchema } from '../load_lab_session/types';
import { StudentCourseLabSchema } from '../student_course_labs/types';
import type { LabSession } from '../load_lab_session/types';
import type { StudentCourseLab } from '../student_course_labs/types';

export const StudentLabContextResponseSchema = z.object({
  success: z.boolean(),
  lab: StudentCourseLabSchema.nullable().optional(),
  session: LabSessionSchema.nullable().optional(),
  message: z.string().optional(),
});

export type StudentLabContextResponse = {
  success: boolean;
  lab?: StudentCourseLab | null;
  session?: LabSession | null;
  message?: string;
};
