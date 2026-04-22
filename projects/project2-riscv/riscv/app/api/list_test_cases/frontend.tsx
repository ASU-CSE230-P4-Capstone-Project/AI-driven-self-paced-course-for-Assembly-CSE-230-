'use client';

import { ListTestCasesResponse } from './types';

/**
 * Frontend function to list all test cases for a lab
 * 
 * @param lab_uid - The UID of the lab to list test cases for
 * @returns ListTestCasesResponse with success status and test cases data
 */
export async function listTestCases(lab_uid: string): Promise<ListTestCasesResponse> {
  try {
    const response = await fetch('/api/list_test_cases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lab_uid }),
    });

    const data: ListTestCasesResponse = await response.json();
    return data;
  } catch (error) {
    console.error('List test cases frontend error:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to the server',
    };
  }
}
