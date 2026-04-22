import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { modifyCookieData } from '@/app/verify/modify';
import { DBConnection } from '@/app/sql/sql';
import {
  UserSettingsSchema,
  type UserSettingsResponse,
} from './types';
import {
  loadUserSettingsForCookie,
  mapRowToSettings,
} from './internal';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
} as const;

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const result = await loadUserSettingsForCookie(cookieHeader);

  if (!result.authenticated) {
    const modifiedCookie = await modifyCookieData({});

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid or missing authentication',
      } satisfies UserSettingsResponse),
      {
        status: 401,
        headers: {
          ...NO_STORE_HEADERS,
          'Set-Cookie': modifiedCookie,
        },
      }
    );
  }

  if (result.success) {
    return new Response(
      JSON.stringify({
        success: true,
        settings: result.settings,
      } satisfies UserSettingsResponse),
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      message: result.message ?? 'Failed to load user settings',
    } satisfies UserSettingsResponse),
    {
      status: 500,
      headers: NO_STORE_HEADERS,
    }
  );
}

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data || !verifyResponse.data.username) {
    const modifiedCookie = await modifyCookieData({});

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid or missing authentication',
      } satisfies UserSettingsResponse),
      {
        status: 401,
        headers: {
          ...NO_STORE_HEADERS,
          'Set-Cookie': modifiedCookie,
        },
      }
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = UserSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid settings payload',
      } satisfies UserSettingsResponse),
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const result = await db.client.query(
      `INSERT INTO user_settings (
          username,
          editor_font_size,
          show_help_bubble,
          open_instructions_by_default,
          warn_before_reinstate,
          updated_at
       )
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (username) DO UPDATE
       SET editor_font_size = EXCLUDED.editor_font_size,
           show_help_bubble = EXCLUDED.show_help_bubble,
           open_instructions_by_default = EXCLUDED.open_instructions_by_default,
           warn_before_reinstate = EXCLUDED.warn_before_reinstate,
           updated_at = now()
       RETURNING editor_font_size,
                 show_help_bubble,
                 open_instructions_by_default,
                 warn_before_reinstate`,
      [
        verifyResponse.data.username,
        parsed.data.editorFontSize,
        parsed.data.showHelpBubble,
        parsed.data.openInstructionsByDefault,
        parsed.data.warnBeforeReinstate,
      ]
    );

    return new Response(
      JSON.stringify({
        success: true,
        settings: mapRowToSettings(result.rows[0]),
      } satisfies UserSettingsResponse),
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error: unknown) {
    console.error('user_settings POST:', error);

    return new Response(
      JSON.stringify({
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to save user settings',
      } satisfies UserSettingsResponse),
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  } finally {
    if (db) {
      try {
        await db.client.end();
      } catch {}
    }
  }
}
