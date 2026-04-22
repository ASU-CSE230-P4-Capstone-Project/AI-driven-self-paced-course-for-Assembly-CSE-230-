'use client';

import { ListCoursesResponse } from './types';

export async function listCourses(): Promise<ListCoursesResponse> {
  try {
    const res = await fetch('/api/list_courses');

    const data: ListCoursesResponse = await res.json();
    return data;
  } catch (error) {
    console.error('List courses frontend error:', error);

    return {
      success: false,
      courses: [],
      message: 'Failed to connect to server',
    };
  }
}
