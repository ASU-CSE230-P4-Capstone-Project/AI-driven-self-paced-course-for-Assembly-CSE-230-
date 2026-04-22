'use client';

import type { StudentLabContextResponse } from './types';

export type StudentLabContextFrontendResponse = StudentLabContextResponse & {
  status?: number;
};

export async function getStudentLabContext(
  course_id: string,
  lab_uid: string,
  storage_key: string,
  student_username?: string
): Promise<StudentLabContextFrontendResponse> {
  try {
    const params = new URLSearchParams({
      course_id,
      lab_uid,
      storage_key,
    });
    if (student_username?.trim()) {
      params.set('student_username', student_username.trim());
    }
    const res = await fetch(`/api/student_lab_context?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        lab: null,
        session: null,
        message: data.message || 'Failed to load lab context',
        status: res.status,
      };
    }

    return {
      ...data,
      status: res.status,
    };
  } catch (error) {
    console.error('Student lab context frontend error:', error);
    return {
      success: false,
      lab: null,
      session: null,
      message: 'Failed to connect to server',
    };
  }
}
