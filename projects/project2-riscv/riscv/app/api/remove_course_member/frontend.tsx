'use client';

import type { RemoveCourseMemberRequest, RemoveCourseMemberResponse } from './types';

export async function removeCourseMember(payload: RemoveCourseMemberRequest): Promise<RemoveCourseMemberResponse> {
  const res = await fetch('/api/remove_course_member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data: RemoveCourseMemberResponse = await res.json();
  if (!res.ok) {
    return { success: false, message: data.message || 'Failed to remove member' };
  }
  return data;
}
