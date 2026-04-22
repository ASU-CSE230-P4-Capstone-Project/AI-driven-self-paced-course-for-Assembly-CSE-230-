import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';

/** GET: list course_ids this lab is assigned to */
export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);
  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response(
      JSON.stringify({ success: false, message: 'Only instructors can view lab courses' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const lab_uid = req.nextUrl.searchParams.get('lab_uid') ?? '';
  if (!lab_uid.trim()) {
    return new Response(
      JSON.stringify({ success: false, message: 'lab_uid required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  let db: DBConnection | null = null;
  try {
    db = await DBConnection.create();
    const result = await db.client.query(
      'SELECT course_id FROM course_labs WHERE lab_uid = $1 ORDER BY course_id',
      [lab_uid]
    );
    const course_ids = result.rows.map((r: { course_id: string }) => r.course_id);
    return new Response(
      JSON.stringify({ success: true, course_ids }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('lab_courses GET:', e);
    return new Response(
      JSON.stringify({ success: false, message: e?.message || 'Failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (db) try { await db.client.end(); } catch (_) {}
  }
}

/** POST: set which courses this lab is assigned to (replaces existing) */
export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);
  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response(
      JSON.stringify({ success: false, message: 'Only instructors can sync lab courses' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  let body: { lab_uid?: string; course_ids?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: 'Invalid JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const lab_uid = (body.lab_uid ?? '').trim();
  const course_ids = Array.isArray(body.course_ids) ? body.course_ids : [];
  if (!lab_uid) {
    return new Response(
      JSON.stringify({ success: false, message: 'lab_uid required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  let db: DBConnection | null = null;
  try {
    db = await DBConnection.create();
    const client = db.client;
    await client.query('DELETE FROM course_labs WHERE lab_uid = $1', [lab_uid]);
    for (const course_id of course_ids) {
      if (!course_id || !/^[0-9]{5}$/.test(String(course_id))) continue;
      await client.query(
        'INSERT INTO course_labs (course_id, lab_uid, position) VALUES ($1, $2, 0) ON CONFLICT (course_id, lab_uid) DO NOTHING',
        [course_id, lab_uid]
      );
    }
    return new Response(
      JSON.stringify({ success: true, message: 'Lab course assignments updated' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('lab_courses POST:', e);
    return new Response(
      JSON.stringify({ success: false, message: e?.message || 'Failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (db) try { await db.client.end(); } catch (_) {}
  }
}
