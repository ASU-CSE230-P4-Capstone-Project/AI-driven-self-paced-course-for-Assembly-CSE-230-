import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { modifyCookieData } from '@/app/verify/modify';
import { DBConnection } from '@/app/sql/sql';
import { serializePersistedInputOverrides } from '@/components/input-overrides';
import { SyncLabSessionRequestSchema, SyncLabSessionResponse } from './types';

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
      } satisfies SyncLabSessionResponse),
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

  const parsed = SyncLabSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Bad Request',
        message: 'Invalid lab session payload',
      } satisfies SyncLabSessionResponse),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const username = String(verifyResponse.data.username);
  const { session } = parsed.data;

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const client = db.client;

    await client.query(
      `INSERT INTO lab_sessions (
          username,
          storage_key,
          uid,
          lab_uid,
          version,
          code,
          resp,
          sim_state,
          step_index,
          all_states,
          register_overrides,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10::jsonb, $11::jsonb, now()
        )
        ON CONFLICT (username, storage_key) DO UPDATE
        SET uid = EXCLUDED.uid,
            lab_uid = EXCLUDED.lab_uid,
            version = EXCLUDED.version,
            code = EXCLUDED.code,
            resp = EXCLUDED.resp,
            sim_state = EXCLUDED.sim_state,
            step_index = EXCLUDED.step_index,
            all_states = EXCLUDED.all_states,
            register_overrides = EXCLUDED.register_overrides,
            updated_at = now()`,
      [
        username,
        session.storageKey,
        session.uid,
        session.labUid ?? null,
        session.version ?? 1,
        session.code,
        JSON.stringify(session.resp ?? null),
        JSON.stringify(session.simState ?? null),
        session.stepIndex,
        JSON.stringify(session.allStates ?? []),
        JSON.stringify(
          serializePersistedInputOverrides(
            session.registerOverrides ?? {},
            session.memoryOverrides ?? {}
          )
        ),
      ]
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lab session synced',
      } satisfies SyncLabSessionResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Sync lab session error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to sync lab session',
      } satisfies SyncLabSessionResponse),
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
