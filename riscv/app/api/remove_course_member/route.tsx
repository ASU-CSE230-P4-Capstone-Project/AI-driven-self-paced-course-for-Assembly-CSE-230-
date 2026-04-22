import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { invalidateUserSessions } from '@/app/verify/session';
import { DBConnection } from '@/app/sql/sql';
import { RemoveCourseMemberRequestSchema } from './types';

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader, {
    requireRecentAuth: true,
  });

  if (verifyResponse.reason === 'reauth_required') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Please sign in again before removing users from courses',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response(
      JSON.stringify({ success: false, message: 'Only instructors can remove course members' }),
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

  const parsed = RemoveCourseMemberRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ success: false, message: 'Invalid payload' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { course_id, username } = parsed.data;
  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const result = await db.client.query(
      `DELETE FROM course_memberships WHERE course_id = $1 AND username = $2 RETURNING 1`,
      [course_id, username]
    );
    if (result.rowCount === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Member not found in course' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    await invalidateUserSessions(username, 'course_membership_removed', db.client);
    return new Response(
      JSON.stringify({ success: true, message: 'Member removed' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Remove course member error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove member',
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
