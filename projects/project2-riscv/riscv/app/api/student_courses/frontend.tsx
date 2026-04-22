'use client';

import type { StudentCoursesResponse } from './types';

export type StudentCoursesFrontendResponse = StudentCoursesResponse & {
  status?: number;
};

export async function getStudentCourses(): Promise<StudentCoursesFrontendResponse> {
  try {
    const res = await fetch('/api/student_courses');
    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        courses: [],
        message: data.message || 'Failed to load student courses',
        status: res.status,
      };
    }

    return {
      ...data,
      status: res.status,
    };
  } catch (error) {
    console.error('Student courses frontend error:', error);
    return {
      success: false,
      courses: [],
      message: 'Failed to connect to server',
    };
  }
}
