'use client';

import type { LabGradesAttemptsResponse } from './types';

export async function getLabGradesAttempts(
  course_id: string,
  lab_uid: string,
  username: string
): Promise<LabGradesAttemptsResponse> {
  try {
    const params = new URLSearchParams({
      course_id,
      lab_uid,
      username,
    });

    const response = await fetch(`/api/lab_grades_attempts?${params.toString()}`);
    const data = (await response.json()) as LabGradesAttemptsResponse;
    return data;
  } catch (error) {
    console.error('Get lab grade attempts frontend error:', error);
    return {
      success: false,
      labUid: lab_uid,
      memberUsername: username,
      testCaseCount: 0,
      maxScore: 0,
      attempts: [],
      message: 'Failed to connect to the server',
    };
  }
}
