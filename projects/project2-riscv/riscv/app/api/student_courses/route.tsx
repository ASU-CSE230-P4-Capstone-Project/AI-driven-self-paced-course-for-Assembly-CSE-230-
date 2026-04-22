import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { modifyCookieData } from '@/app/verify/modify';
import { DBConnection } from '@/app/sql/sql';
import type { StudentCoursesResponse } from './types';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data || !verifyResponse.data.username) {
    const modifiedCookie = await modifyCookieData({});

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid or missing authentication',
      } satisfies StudentCoursesResponse),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': modifiedCookie,
        },
      }
    );
  }

  if (verifyResponse.data.student !== true) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Only students can view student courses',
      } satisfies StudentCoursesResponse),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const result = await db.client.query(
      `SELECT c.course_id, c.code, c.title, c.term
       FROM course_memberships cm
       JOIN courses c ON c.course_id = cm.course_id
       WHERE cm.username = $1
         AND cm.role = 'student'
         AND cm.status = 'active'
       ORDER BY c.code ASC, c.term ASC NULLS LAST, c.title ASC`,
      [verifyResponse.data.username]
    );

    return new Response(
      JSON.stringify({
        success: true,
        courses: result.rows,
      } satisfies StudentCoursesResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('student_courses GET:', error);

    return new Response(
      JSON.stringify({
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to load student courses',
      } satisfies StudentCoursesResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
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
