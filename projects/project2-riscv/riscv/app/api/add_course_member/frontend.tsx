'use client';

import type { AddCourseMemberRequest, AddCourseMemberResponse } from './types';

export async function addCourseMember(payload: AddCourseMemberRequest): Promise<AddCourseMemberResponse> {
  const res = await fetch('/api/add_course_member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data: AddCourseMemberResponse = await res.json();
  if (!res.ok) {
    return { success: false, message: data.message || 'Failed to add member' };
  }
  return data;
}
