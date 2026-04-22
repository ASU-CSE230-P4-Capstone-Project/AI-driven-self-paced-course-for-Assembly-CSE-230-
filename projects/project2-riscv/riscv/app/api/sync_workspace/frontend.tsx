'use client';

import type { SyncWorkspaceRequest, SyncWorkspaceResponse } from './types';
import type { Workspace } from '@/components/types';

export async function syncWorkspace(workspace: Workspace): Promise<SyncWorkspaceResponse> {
  try {
    const response = await fetch('/api/sync_workspace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ workspace } satisfies SyncWorkspaceRequest),
    });

    const data: SyncWorkspaceResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Sync workspace frontend error:', error);
    return {
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to the server',
    };
  }
}
