import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { modifyCookieData } from '@/app/verify/modify';
import { DBConnection } from '@/app/sql/sql';
import { serializePersistedInputOverrides } from '@/components/input-overrides';
import { SyncWorkspaceRequestSchema, SyncWorkspaceResponse } from './types';

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
      } satisfies SyncWorkspaceResponse),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': modifiedCookie,
        },
      }
    );
  }

  let body: unknown = null;
  try {
    const raw = await req.text();
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }

  const parsed = SyncWorkspaceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Bad Request',
        message: 'Invalid workspace payload',
      } satisfies SyncWorkspaceResponse),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const username = String(verifyResponse.data.username);
  const { workspace } = parsed.data;

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const client = db.client;

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO workspaces (username, uid, current_project_id, updated_at)
       VALUES ($1, $2, NULL, now())
       ON CONFLICT (username) DO UPDATE
       SET uid = EXCLUDED.uid,
           current_project_id = NULL,
           updated_at = now()`,
      [username, workspace.uid]
    );

    const projectIds: string[] = [];
    for (const project of workspace.projects) {
      projectIds.push(project.id);
      const state = project.state ?? {};
      const createdAt = project.createdAt ?? new Date().toISOString();
      const code = typeof state.code === 'string' ? state.code : '';
      const stepIndex = typeof state.stepIndex === 'number' ? state.stepIndex : 0;
      const allStates = Array.isArray(state.allStates) ? state.allStates : [];
      const registerOverrides =
        state.registerOverrides && typeof state.registerOverrides === 'object'
          ? state.registerOverrides
          : {};
      const memoryOverrides =
        state.memoryOverrides && typeof state.memoryOverrides === 'object'
          ? state.memoryOverrides
          : {};

      await client.query(
        `INSERT INTO workspace_projects (
            id,
            workspace_username,
            name,
            description,
            created_at,
            updated_at,
            code,
            resp,
            sim_state,
            step_index,
            all_states,
            register_overrides
          ) VALUES (
            $1, $2, $3, $4, $5, now(), $6, $7::jsonb, $8::jsonb, $9, $10::jsonb, $11::jsonb
          )
          ON CONFLICT (id) DO UPDATE
          SET workspace_username = EXCLUDED.workspace_username,
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              created_at = EXCLUDED.created_at,
              updated_at = now(),
              code = EXCLUDED.code,
              resp = EXCLUDED.resp,
              sim_state = EXCLUDED.sim_state,
              step_index = EXCLUDED.step_index,
              all_states = EXCLUDED.all_states,
              register_overrides = EXCLUDED.register_overrides`,
        [
          project.id,
          username,
          project.name,
          project.description ?? '',
          createdAt,
          code,
          JSON.stringify(state.resp ?? null),
          JSON.stringify(state.simState ?? null),
          stepIndex,
          JSON.stringify(allStates),
          JSON.stringify(
            serializePersistedInputOverrides(registerOverrides, memoryOverrides)
          ),
        ]
      );
    }

    if (projectIds.length === 0) {
      await client.query(
        'DELETE FROM workspace_projects WHERE workspace_username = $1',
        [username]
      );
    } else {
      await client.query(
        'DELETE FROM workspace_projects WHERE workspace_username = $1 AND NOT (id = ANY($2))',
        [username, projectIds]
      );
    }

    if (workspace.currentProjectId && projectIds.includes(workspace.currentProjectId)) {
      await client.query(
        'UPDATE workspaces SET current_project_id = $2, updated_at = now() WHERE username = $1',
        [username, workspace.currentProjectId]
      );
    }

    await client.query('COMMIT');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Workspace synced',
      } satisfies SyncWorkspaceResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    if (db) {
      try {
        await db.client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Workspace sync rollback error:', rollbackError);
      }
    }

    console.error('Sync workspace error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to sync workspace',
      } satisfies SyncWorkspaceResponse),
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
