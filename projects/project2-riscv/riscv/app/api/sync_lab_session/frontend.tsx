'use client';

import type { LabSession, SyncLabSessionRequest, SyncLabSessionResponse } from './types';

export async function syncLabSession(session: LabSession): Promise<SyncLabSessionResponse> {
  try {
    const response = await fetch('/api/sync_lab_session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session } satisfies SyncLabSessionRequest),
    });

    const data: SyncLabSessionResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Sync lab session frontend error:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to the server',
    };
  }
}
