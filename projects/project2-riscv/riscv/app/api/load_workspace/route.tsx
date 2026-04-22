import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { modifyCookieData } from '@/app/verify/modify';
import { DBConnection } from '@/app/sql/sql';
import { parsePersistedInputOverrides } from '@/components/input-overrides';
import type { Project } from '@/components/types';
import type { LoadWorkspaceResponse } from './types';

type WorkspaceProjectRow = {
  id: string;
  name: string | null;
  description: string | null;
  created_at: string | Date | null;
  code: string | null;
  resp: unknown;
  sim_state: unknown;
  step_index: number | null;
  all_states: unknown;
  register_overrides: unknown;
};

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data || !verifyResponse.data.username) {
    const modifiedCookie = await modifyCookieData({});

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or missing authentication',
      } satisfies LoadWorkspaceResponse),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': modifiedCookie,
        },
      }
    );
  }

  const username = String(verifyResponse.data.username);
  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const client = db.client;

    const workspaceResult = await client.query(
      'SELECT uid, current_project_id FROM workspaces WHERE username = $1',
      [username]
    );

    if (workspaceResult.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          workspace: null,
          message: 'No workspace found',
        } satisfies LoadWorkspaceResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const workspaceRow = workspaceResult.rows[0];

    const projectsResult = await client.query(
      `SELECT id, name, description, created_at, code, resp, sim_state, step_index, all_states, register_overrides
       FROM workspace_projects
       WHERE workspace_username = $1
       ORDER BY created_at ASC`,
      [username]
    );

    const projects: Project[] = projectsResult.rows.map((row: WorkspaceProjectRow) => {
      const overrides = parsePersistedInputOverrides(row.register_overrides);

      return {
        id: row.id,
        name: row.name ?? '',
        description: row.description ?? '',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        state: {
          code: row.code ?? '',
          resp: (row.resp as Project['state']['resp'] | null) ?? null,
          simState: (row.sim_state as Project['state']['simState'] | null) ?? null,
          stepIndex: typeof row.step_index === 'number' ? row.step_index : 0,
          allStates: Array.isArray(row.all_states)
            ? (row.all_states as Project['state']['allStates'])
            : [],
          registerOverrides: overrides.registerOverrides,
          memoryOverrides: overrides.memoryOverrides,
        },
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        workspace: {
          uid: workspaceRow.uid,
          currentProjectId: workspaceRow.current_project_id ?? null,
          projects,
        },
      } satisfies LoadWorkspaceResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Load workspace error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to load workspace',
      } satisfies LoadWorkspaceResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    if (db) {
      try {
        await db.client.end();
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }
  }
}
