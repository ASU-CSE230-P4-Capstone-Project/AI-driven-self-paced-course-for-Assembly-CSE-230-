'use client';

export type CourseLab = { lab_uid: string; title: string };

export async function getCourseLabs(course_id: string): Promise<{ success: boolean; labs?: CourseLab[]; message?: string }> {
  const res = await fetch(`/api/course_labs?course_id=${encodeURIComponent(course_id)}`);
  const data = await res.json();
  if (!res.ok) return { success: false, message: data.message || 'Failed' };
  return data;
}
