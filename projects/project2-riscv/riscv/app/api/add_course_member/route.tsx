import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { invalidateUserSessions } from '@/app/verify/session';
import { DBConnection } from '@/app/sql/sql';
import { AddCourseMemberRequestSchema } from './types';
import { getMissingAsuidMessage, isValidAsuid } from '@/app/lib/asuid';

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader, {
    requireRecentAuth: true,
  });

  if (verifyResponse.reason === 'reauth_required') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Please sign in again before adding users to courses',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!verifyResponse.data?.username || verifyResponse.data.instructor !== true) {
    return new Response(
      JSON.stringify({ success: false, message: 'Only instructors can add course members' }),
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

  const parsed = AddCourseMemberRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ success: false, message: 'Invalid payload; role must be student, instructor, or ta' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { course_id, username, role } = parsed.data;
  const addedBy = verifyResponse.data.username as string;
  let db: DBConnection | null = null;
  let transactionStarted = false;

  try {
    db = await DBConnection.create();
    const client = db.client;

    const courseCheck = await client.query('SELECT 1 FROM courses WHERE course_id = $1', [course_id]);
    if (courseCheck.rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Course not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const userCheck = await client.query('SELECT asuid FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const userAsuid = userCheck.rows[0]?.asuid;
    if (!isValidAsuid(typeof userAsuid === 'string' ? userAsuid : null)) {
      return new Response(
        JSON.stringify({ success: false, message: getMissingAsuidMessage(username) }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await client.query('BEGIN');
    transactionStarted = true;

    if (role === 'instructor') {
      await client.query('UPDATE users SET instructor = true WHERE username = $1', [username]);
    }

    await client.query(
      `INSERT INTO course_memberships (course_id, username, role, status, added_by)
       VALUES ($1, $2, $3, 'active', $4)
       ON CONFLICT (course_id, username) DO UPDATE SET role = $3, status = 'active'`,
      [course_id, username, role, addedBy]
    );
    await invalidateUserSessions(
      username,
      role === 'instructor' ? 'instructor_promoted' : 'course_membership_changed',
      client
    );

    await client.query('COMMIT');
    transactionStarted = false;

    return new Response(
      JSON.stringify({
        success: true,
        message:
          role === 'instructor'
            ? 'Member promoted to instructor and added to course'
            : 'Member added',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    if (db && transactionStarted) {
      try {
        await db.client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Add course member rollback error:', rollbackError);
      }
    }
    console.error('Add course member error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add member',
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
