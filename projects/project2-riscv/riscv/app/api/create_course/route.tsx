import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';
import { CreateCourseRequestSchema } from './types';

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader, {
    requireRecentAuth: true,
  });

  if (verifyResponse.reason === 'reauth_required') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Please sign in again before creating courses',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response(
      JSON.stringify({ success: false, message: 'Only instructors can create courses' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const parsed = CreateCourseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ success: false, message: parsed.error.issues.map((e) => e.message).join(', ') }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { course_id, code, title, term } = parsed.data;
  const username = verifyResponse.data.username as string;
  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const client = db.client;

    await client.query(
      `INSERT INTO courses (course_id, code, title, term) VALUES ($1, $2, $3, $4)`,
      [course_id, code, title, term ?? null]
    );

    await client.query(
      `INSERT INTO course_memberships (course_id, username, role, status, added_by) VALUES ($1, $2, 'instructor', 'active', $3)`,
      [course_id, username, username]
    );

    return new Response(
      JSON.stringify({ success: true, message: 'Course created' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      return new Response(
        JSON.stringify({ success: false, message: 'Course ID or code+term already exists' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.error('Create course error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create course',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (db) {
      try {
        await db.client.end();
      } catch (e) {
        console.error('Error closing db:', e);
      }
    }
  }
}
