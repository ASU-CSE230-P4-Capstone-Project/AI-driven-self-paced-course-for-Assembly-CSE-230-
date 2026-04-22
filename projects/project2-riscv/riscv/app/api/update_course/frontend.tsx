'use client';

import type { UpdateCourseRequest, UpdateCourseResponse } from './types';

export async function updateCourse(payload: UpdateCourseRequest): Promise<UpdateCourseResponse> {
  const res = await fetch('/api/update_course', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data: UpdateCourseResponse = await res.json();
  if (!res.ok) {
    return { success: false, message: data.message || 'Failed to update course' };
  }
  return data;
}
