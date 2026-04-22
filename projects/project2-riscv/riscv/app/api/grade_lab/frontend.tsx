'use client';

import type { GradeLabResponse } from './types';

export async function gradeLab(
  code: string,
  course_id: string,
  lab_uid: string,
  grade_session_id?: string
): Promise<GradeLabResponse> {
  try {
    const response = await fetch('/api/grade_lab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, course_id, lab_uid, grade_session_id }),
    });

    const data: GradeLabResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Grade lab frontend error:', error);
    return {
      pass: false,
      error: 'Failed to connect to the server',
    };
  }
}
