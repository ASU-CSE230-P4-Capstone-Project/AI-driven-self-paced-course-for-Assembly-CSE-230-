import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { modifyCookieData } from '@/app/verify/modify';
import { DBConnection } from '@/app/sql/sql';
import type { StudentCourseLabsResponse } from './types';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data || !verifyResponse.data.username) {
    const modifiedCookie = await modifyCookieData({});

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid or missing authentication',
      } satisfies StudentCourseLabsResponse),
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
        message: 'Only students can view student course labs',
      } satisfies StudentCourseLabsResponse),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const course_id = req.nextUrl.searchParams.get('course_id') ?? '';
  if (!/^[0-9]{5}$/.test(course_id)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Valid course_id (5 digits) required',
      } satisfies StudentCourseLabsResponse),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const client = db.client;

    const membershipResult = await client.query(
      `SELECT 1
       FROM course_memberships
       WHERE course_id = $1
         AND username = $2
         AND role = 'student'
         AND status = 'active'
       LIMIT 1`,
      [course_id, verifyResponse.data.username]
    );

    if (membershipResult.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'You are not enrolled in this course',
        } satisfies StudentCourseLabsResponse),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await client.query(
      `SELECT l.uid, l.title, l.md
       FROM course_labs cl
       JOIN labs l ON l.uid = cl.lab_uid
       WHERE cl.course_id = $1
       ORDER BY cl.position ASC, l.title ASC`,
      [course_id]
    );

    return new Response(
      JSON.stringify({
        success: true,
        labs: result.rows,
      } satisfies StudentCourseLabsResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('student_course_labs GET:', error);

    return new Response(
      JSON.stringify({
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to load student course labs',
      } satisfies StudentCourseLabsResponse),
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
