'use client';

export async function getLabCourses(lab_uid: string): Promise<{ success: boolean; course_ids?: string[]; message?: string }> {
  const res = await fetch(`/api/lab_courses?lab_uid=${encodeURIComponent(lab_uid)}`);
  const data = await res.json();
  if (!res.ok) return { success: false, message: data.message || 'Failed' };
  return data;
}

export async function syncLabCourses(lab_uid: string, course_ids: string[]): Promise<{ success: boolean; message?: string }> {
  const res = await fetch('/api/lab_courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lab_uid, course_ids }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, message: data.message || 'Failed' };
  return data;
}
