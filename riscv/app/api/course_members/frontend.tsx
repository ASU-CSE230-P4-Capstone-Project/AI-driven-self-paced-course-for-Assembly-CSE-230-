'use client';

import type { CourseMembersResponse } from './types';

export async function getCourseMembers(courseId: string): Promise<CourseMembersResponse> {
  const res = await fetch(`/api/course_members?course_id=${encodeURIComponent(courseId)}`);
  const data: CourseMembersResponse = await res.json();
  if (!res.ok) {
    return { success: false, message: data.message || 'Failed to load members' };
  }
  return data;
}
