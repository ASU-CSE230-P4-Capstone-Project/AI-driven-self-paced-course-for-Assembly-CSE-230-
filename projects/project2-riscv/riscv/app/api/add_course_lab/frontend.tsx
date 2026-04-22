'use client';

export type AddCourseLabRequest = {
  course_id: string;
  lab_uid: string;
};

export type AddCourseLabResponse = {
  success: boolean;
  message?: string;
};

export async function addCourseLab(
  payload: AddCourseLabRequest
): Promise<AddCourseLabResponse> {
  const res = await fetch('/api/add_course_lab', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data: AddCourseLabResponse = await res.json();
  if (!res.ok) {
    return { success: false, message: data.message || 'Failed to add lab to course' };
  }
  return data;
}
