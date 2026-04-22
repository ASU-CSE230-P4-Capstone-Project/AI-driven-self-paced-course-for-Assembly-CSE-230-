import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';
import { UpdateCourseRequestSchema } from './types';

export async function PATCH(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader, {
    requireRecentAuth: true,
  });

  if (verifyResponse.reason === 'reauth_required') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Please sign in again before updating courses',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response(
      JSON.stringify({ success: false, message: 'Only instructors can update courses' }),
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

  const parsed = UpdateCourseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ success: false, message: 'Invalid payload' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { course_id, code, title, term } = parsed.data;
  const updates: string[] = [];
  const values: (string | null)[] = [];
  let idx = 1;
  if (code !== undefined) {
    updates.push(`code = $${idx++}`);
    values.push(code);
  }
  if (title !== undefined) {
    updates.push(`title = $${idx++}`);
    values.push(title);
  }
  if (term !== undefined) {
    updates.push(`term = $${idx++}`);
    values.push(term);
  }
  if (updates.length === 0) {
    return new Response(
      JSON.stringify({ success: false, message: 'No fields to update' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  updates.push(`updated_at = now()`);
  values.push(course_id);

  let db: DBConnection | null = null;
  try {
    db = await DBConnection.create();
    await db.client.query(
      `UPDATE courses SET ${updates.join(', ')} WHERE course_id = $${idx}`,
      values
    );
    return new Response(
      JSON.stringify({ success: true, message: 'Course updated' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Update course error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update course',
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
