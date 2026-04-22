'use client';

import type { StudentCourseLabsResponse } from './types';

export type StudentCourseLabsFrontendResponse = StudentCourseLabsResponse & {
  status?: number;
};

export async function getStudentCourseLabs(
  course_id: string
): Promise<StudentCourseLabsFrontendResponse> {
  try {
    const res = await fetch(
      `/api/student_course_labs?course_id=${encodeURIComponent(course_id)}`
    );
    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        labs: [],
        message: data.message || 'Failed to load course labs',
        status: res.status,
      };
    }

    return {
      ...data,
      status: res.status,
    };
  } catch (error) {
    console.error('Student course labs frontend error:', error);
    return {
      success: false,
      labs: [],
      message: 'Failed to connect to server',
    };
  }
}
