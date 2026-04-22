'use client';

import type { LoadLabSessionResponse } from './types';

export async function loadLabSession(storageKey: string): Promise<LoadLabSessionResponse> {
  try {
    const response = await fetch('/api/load_lab_session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storageKey }),
    });

    const data: LoadLabSessionResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Load lab session frontend error:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to the server',
    };
  }
}
