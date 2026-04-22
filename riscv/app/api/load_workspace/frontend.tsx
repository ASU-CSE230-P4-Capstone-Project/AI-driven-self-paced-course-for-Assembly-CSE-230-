'use client';

import type { LoadWorkspaceResponse } from './types';

export async function loadWorkspace(): Promise<LoadWorkspaceResponse> {
  try {
    const response = await fetch('/api/load_workspace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data: LoadWorkspaceResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Load workspace frontend error:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to the server',
    };
  }
}
