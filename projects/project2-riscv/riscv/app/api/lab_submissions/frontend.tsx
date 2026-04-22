'use client';

import type {
  LabSubmissionsResponse,
  SaveLabSubmissionRequest,
} from './types';

export async function getLabSubmissions(
  course_id: string,
  lab_uid: string,
  student_username?: string
): Promise<LabSubmissionsResponse> {
  try {
    const params = new URLSearchParams({
      course_id,
      lab_uid,
    });
    if (student_username?.trim()) {
      params.set('student_username', student_username.trim());
    }

    const response = await fetch(
      `/api/lab_submissions?${params.toString()}`
    );
    const data: LabSubmissionsResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Get lab submissions frontend error:', error);
    return {
      success: false,
      submissions: [],
      message: 'Failed to connect to the server',
    };
  }
}

export async function saveLabSubmission(
  submission: SaveLabSubmissionRequest
): Promise<LabSubmissionsResponse> {
  try {
    const response = await fetch('/api/lab_submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submission),
    });

    const data: LabSubmissionsResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Save lab submission frontend error:', error);
    return {
      success: false,
      message: 'Failed to connect to the server',
    };
  }
}
