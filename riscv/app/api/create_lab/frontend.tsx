'use client';

import { CreateLabResponse } from './types';

/**
 * Frontend function to create a new lab
 * 
 * @param name - The name/title of the new lab
 * @returns CreateLabResponse with success status and created lab data
 */
export async function createLab(name: string): Promise<CreateLabResponse> {
  try {
    const response = await fetch('/api/create_lab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    const data: CreateLabResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Create lab frontend error:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to the server',
    };
  }
}
