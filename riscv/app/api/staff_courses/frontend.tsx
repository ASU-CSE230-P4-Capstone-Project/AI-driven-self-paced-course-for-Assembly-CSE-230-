'use client';

import type { ListCoursesResponse } from '@/app/api/list_courses/types';

export async function listStaffCourses(): Promise<ListCoursesResponse> {
  try {
    const res = await fetch('/api/staff_courses');
    const data: ListCoursesResponse = await res.json();
    return data;
  } catch (error) {
    console.error('List staff courses frontend error:', error);

    return {
      success: false,
      courses: [],
      message: 'Failed to connect to server',
    };
  }
}
