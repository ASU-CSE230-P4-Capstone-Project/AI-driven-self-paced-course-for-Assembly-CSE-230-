'use client';

import type { CourseLabSubmissionsOverviewResponse } from './types';

export async function getCourseLabSubmissionsOverview(
  course_id: string,
  lab_uid: string
): Promise<CourseLabSubmissionsOverviewResponse> {
  try {
    const response = await fetch(
      `/api/course_lab_submissions_overview?course_id=${encodeURIComponent(course_id)}&lab_uid=${encodeURIComponent(lab_uid)}`
    );
    const data: CourseLabSubmissionsOverviewResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Course lab submissions overview frontend error:', error);
    return {
      success: false,
      students: [],
      message: 'Failed to connect to the server',
    };
  }
}
