'use client';

import { ListLabsResponse } from './types';

/**
 * Fetches all labs from the API
 * @returns Promise with list of labs or error response
 */
export async function listLabs(): Promise<ListLabsResponse> {
  try {
    const response = await fetch('/api/list_labs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching labs:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to fetch labs: ' + (error instanceof Error ? error.message : 'Unknown error'),
    };
  }
}
