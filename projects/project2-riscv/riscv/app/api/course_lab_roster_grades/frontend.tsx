'use client';

import type { CourseLabRosterGradesResponse } from './types';

export async function getCourseLabRosterGrades(
  courseId: string,
  labUid: string
): Promise<CourseLabRosterGradesResponse> {
  try {
    const res = await fetch(
      `/api/course_lab_roster_grades?course_id=${encodeURIComponent(courseId)}&lab_uid=${encodeURIComponent(labUid)}`
    );
    const data: CourseLabRosterGradesResponse = await res.json();
    return data;
  } catch (error) {
    console.error('Course lab roster grades frontend error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to load course lab roster grades',
    };
  }
}
