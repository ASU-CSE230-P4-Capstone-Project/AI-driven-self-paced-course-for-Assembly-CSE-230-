'use client';

import { UpdateLabResponse } from './types';
import { Lab } from '@/app/api/list_labs/types';

/**
 * Frontend function to update a lab
 * 
 * @param lab - The lab object with updated data
 * @returns UpdateLabResponse with success status and updated lab data
 */
export async function updateLab(lab: Lab): Promise<UpdateLabResponse> {
  try {
    const response = await fetch('/api/update_lab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lab),
    });

    const data: UpdateLabResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Update lab frontend error:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to the server',
    };
  }
}
