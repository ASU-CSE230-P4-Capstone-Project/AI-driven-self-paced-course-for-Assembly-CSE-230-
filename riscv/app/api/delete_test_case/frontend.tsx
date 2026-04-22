'use client';

import { DeleteTestCaseResponse } from './types';

/**
 * Frontend function to delete a test case
 * 
 * @param uid - The UID of the test case to delete
 * @returns DeleteTestCaseResponse with success status
 */
export async function deleteTestCase(uid: string): Promise<DeleteTestCaseResponse> {
  try {
    const response = await fetch('/api/delete_test_case', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid }),
    });

    const data: DeleteTestCaseResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Delete test case frontend error:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to the server',
    };
  }
}
