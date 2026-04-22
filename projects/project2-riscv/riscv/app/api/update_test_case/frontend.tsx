'use client';

import { UpdateTestCaseRequest, UpdateTestCaseResponse } from './types';

/**
 * Frontend function to update a test case
 * 
 * @param data - The update data including uid and fields to update
 * @returns UpdateTestCaseResponse with success status and updated test case data
 */
export async function updateTestCase(data: UpdateTestCaseRequest): Promise<UpdateTestCaseResponse> {
  try {
    const response = await fetch('/api/update_test_case', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const responseData: UpdateTestCaseResponse = await response.json();
    return responseData;
  } catch (error) {
    console.error('Update test case frontend error:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to the server',
    };
  }
}
