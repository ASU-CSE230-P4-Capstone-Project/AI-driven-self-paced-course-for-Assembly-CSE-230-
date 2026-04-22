'use client';

export type RemoveCourseLabRequest = {
  course_id: string;
  lab_uid: string;
};

export type RemoveCourseLabResponse = {
  success: boolean;
  message?: string;
};

export async function removeCourseLab(
  payload: RemoveCourseLabRequest
): Promise<RemoveCourseLabResponse> {
  const res = await fetch('/api/remove_course_lab', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data: RemoveCourseLabResponse = await res.json();
  if (!res.ok) {
    return { success: false, message: data.message || 'Failed to remove lab from course' };
  }
  return data;
}
