'use client';

import { DeleteLabResponse } from './types';

/**
 * Frontend function to delete a lab
 * 
 * @param uid - The UID of the lab to delete
 * @returns DeleteLabResponse with success status
 */
export async function deleteLab(uid: string): Promise<DeleteLabResponse> {
  try {
    const response = await fetch('/api/delete_lab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid }),
    });

    const data: DeleteLabResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Delete lab frontend error:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to the server',
    };
  }
}
