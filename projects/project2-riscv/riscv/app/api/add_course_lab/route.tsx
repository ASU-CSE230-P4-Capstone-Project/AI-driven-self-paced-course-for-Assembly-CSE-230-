import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader, {
    requireRecentAuth: true,
  });
  if (verifyResponse.reason === 'reauth_required') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Please sign in again before updating course labs',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response(
      JSON.stringify({ success: false, message: 'Only instructors can add labs to courses' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  let body: { course_id?: string; lab_uid?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: 'Invalid JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const course_id = (body.course_id ?? '').trim();
  const lab_uid = (body.lab_uid ?? '').trim();
  if (!/^[0-9]{5}$/.test(course_id) || !lab_uid) {
    return new Response(
      JSON.stringify({ success: false, message: 'course_id (5 digits) and lab_uid required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  let db: DBConnection | null = null;
  try {
    db = await DBConnection.create();
    await db.client.query(
      'INSERT INTO course_labs (course_id, lab_uid, position) VALUES ($1, $2, 0) ON CONFLICT (course_id, lab_uid) DO NOTHING',
      [course_id, lab_uid]
    );
    return new Response(
      JSON.stringify({ success: true, message: 'Lab added to course' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('add_course_lab:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (db) try { await db.client.end(); } catch {}
  }
}
