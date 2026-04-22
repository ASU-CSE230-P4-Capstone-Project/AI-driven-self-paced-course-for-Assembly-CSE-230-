import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';

/** GET: list labs assigned to this course (lab_uid, title) */
export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);
  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response(
      JSON.stringify({ success: false, message: 'Only course staff can view course labs' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const course_id = req.nextUrl.searchParams.get('course_id') ?? '';
  if (!/^[0-9]{5}$/.test(course_id)) {
    return new Response(
      JSON.stringify({ success: false, message: 'Valid course_id (5 digits) required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  let db: DBConnection | null = null;
  try {
    db = await DBConnection.create();
    const username = String(verifyResponse.data.username);
    const membershipResult = await db.client.query(
      `SELECT 1
       FROM course_memberships
       WHERE course_id = $1
         AND username = $2
         AND role IN ('instructor', 'ta')
         AND status = 'active'
       LIMIT 1`,
      [course_id, username]
    );
    if (membershipResult.rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'You are not assigned to this course' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const result = await db.client.query(
      `SELECT l.uid AS lab_uid, l.title
       FROM course_labs cl
       JOIN labs l ON l.uid = cl.lab_uid
       WHERE cl.course_id = $1
       ORDER BY cl.position, l.title`,
      [course_id]
    );
    const labs = result.rows.map((r: { lab_uid: string; title: string }) => ({ lab_uid: r.lab_uid, title: r.title }));
    return new Response(
      JSON.stringify({ success: true, labs }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    console.error('course_labs GET:', e);
    return new Response(
      JSON.stringify({ success: false, message: e instanceof Error ? e.message : 'Failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (db) try { await db.client.end(); } catch {}
  }
}
