'use client';

import { ScoreResponse } from './types';

/**
 * Frontend function to score code against a test case
 * 
 * @param code - The RISC-V assembly code to test
 * @param test_uid - The UID of the test case to score against
 * @returns ScoreResponse with pass status
 */
export async function scoreTestCase(
  code: string,
  course_id: string,
  test_uid: string,
  grade_session_id?: string
): Promise<ScoreResponse> {
  try {
    const response = await fetch('/api/score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, course_id, test_uid, grade_session_id }),
    });

    const data: ScoreResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Score test case frontend error:', error);
    return {
      pass: false,
      error: 'Failed to connect to the server',
    };
  }
}
