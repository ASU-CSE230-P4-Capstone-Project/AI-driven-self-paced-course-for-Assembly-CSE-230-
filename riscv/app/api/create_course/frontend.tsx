'use client';

import type { CreateCourseRequest, CreateCourseResponse } from './types';

export async function createCourse(payload: CreateCourseRequest): Promise<CreateCourseResponse> {
  const res = await fetch('/api/create_course', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data: CreateCourseResponse = await res.json();
  if (!res.ok) {
    return { success: false, message: data.message || 'Failed to create course' };
  }
  return data;
}
