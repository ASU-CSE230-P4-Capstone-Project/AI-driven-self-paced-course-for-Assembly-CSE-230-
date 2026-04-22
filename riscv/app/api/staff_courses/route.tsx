import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response(
      JSON.stringify({ success: false, courses: [], message: 'Only course staff can list staff courses' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const username = String(verifyResponse.data.username);

    const result = await db.client.query(
      `SELECT DISTINCT c.course_id, c.code, c.title, c.term
       FROM course_memberships cm
       JOIN courses c ON c.course_id = cm.course_id
       WHERE cm.username = $1
         AND cm.role IN ('instructor', 'ta')
         AND cm.status = 'active'
       ORDER BY c.code ASC, c.term ASC NULLS LAST, c.title ASC`,
      [username]
    );

    return new Response(
      JSON.stringify({
        success: true,
        courses: result.rows,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('staff_courses GET:', error);

    return new Response(
      JSON.stringify({
        success: false,
        courses: [],
        message: error instanceof Error ? error.message : 'Failed to load staff courses',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (db) {
      try {
        await db.client.end();
      } catch {
        // ignore
      }
    }
  }
}
