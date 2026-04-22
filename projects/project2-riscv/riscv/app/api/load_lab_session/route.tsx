import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { modifyCookieData } from '@/app/verify/modify';
import { DBConnection } from '@/app/sql/sql';
import { parsePersistedInputOverrides } from '@/components/input-overrides';
import { z } from 'zod';
import type { LoadLabSessionResponse } from './types';

const LoadLabSessionRequestSchema = z.object({
  storageKey: z.string(),
});

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
      } satisfies LoadLabSessionResponse),
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

  const parsed = LoadLabSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Bad Request',
        message: 'Invalid storage key',
      } satisfies LoadLabSessionResponse),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const username = String(verifyResponse.data.username);
  const storageKey = parsed.data.storageKey;
  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const client = db.client;

    const sessionResult = await client.query(
      `SELECT uid, lab_uid, version, code, resp, sim_state, step_index, all_states, register_overrides
       FROM lab_sessions
       WHERE username = $1 AND storage_key = $2
       LIMIT 1`,
      [username, storageKey]
    );

    if (sessionResult.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          session: null,
          message: 'No lab session found',
        } satisfies LoadLabSessionResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const row = sessionResult.rows[0];
    const overrides = parsePersistedInputOverrides(row.register_overrides);

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          storageKey,
          uid: row.uid,
          labUid: row.lab_uid ?? null,
          version: typeof row.version === 'number' ? row.version : 1,
          code: row.code ?? '',
          resp: row.resp ?? null,
          simState: row.sim_state ?? null,
          stepIndex: typeof row.step_index === 'number' ? row.step_index : 0,
          allStates: Array.isArray(row.all_states) ? row.all_states : [],
          registerOverrides: overrides.registerOverrides,
          memoryOverrides: overrides.memoryOverrides,
        },
      } satisfies LoadLabSessionResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Load lab session error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to load lab session',
      } satisfies LoadLabSessionResponse),
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
