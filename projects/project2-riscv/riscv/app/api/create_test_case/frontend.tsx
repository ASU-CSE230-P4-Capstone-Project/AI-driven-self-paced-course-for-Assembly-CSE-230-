'use client';

import { CreateTestCaseResponse } from './types';

/**
 * Frontend function to create a new test case for a lab
 * 
 * @param lab_uid - The UID of the lab to create the test case for
 * @param name - The name of the new test case
 * @returns CreateTestCaseResponse with success status and created test case data
 */
export async function createTestCase(lab_uid: string, name: string): Promise<CreateTestCaseResponse> {
  try {
    const response = await fetch('/api/create_test_case', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lab_uid, name }),
    });

    const data: CreateTestCaseResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Create test case frontend error:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to the server',
    };
  }
}
