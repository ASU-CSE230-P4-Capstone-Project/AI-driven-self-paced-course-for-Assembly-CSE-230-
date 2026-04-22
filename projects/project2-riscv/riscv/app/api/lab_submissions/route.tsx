import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { modifyCookieData } from '@/app/verify/modify';
import { DBConnection } from '@/app/sql/sql';
import {
  SaveLabSubmissionRequestSchema,
  type LabSubmissionsResponse,
} from './types';

async function hasCourseLabAccess(
  client: DBConnection['client'],
  username: string,
  courseId: string,
  labUid: string
): Promise<boolean> {
  const accessResult = await client.query(
    `SELECT 1
     FROM course_memberships cm
     JOIN course_labs cl ON cl.course_id = cm.course_id
     WHERE cm.username = $1
       AND cm.course_id = $2
       AND cm.role = 'student'
       AND cm.status = 'active'
       AND cl.lab_uid = $3
     LIMIT 1`,
    [username, courseId, labUid]
  );

  return accessResult.rows.length > 0;
}

async function hasStaffCourseAccess(
  client: DBConnection['client'],
  username: string,
  courseId: string
): Promise<boolean> {
  const accessResult = await client.query(
    `SELECT 1
     FROM course_memberships
     WHERE username = $1
       AND course_id = $2
       AND role IN ('ta', 'instructor')
       AND status = 'active'
     LIMIT 1`,
    [username, courseId]
  );

  return accessResult.rows.length > 0;
}

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data || !verifyResponse.data.username) {
    const modifiedCookie = await modifyCookieData({});

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid or missing authentication',
      } satisfies LabSubmissionsResponse),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': modifiedCookie,
        },
      }
    );
  }

  const course_id = req.nextUrl.searchParams.get('course_id') ?? '';
  const lab_uid = req.nextUrl.searchParams.get('lab_uid') ?? '';
  const requestedStudentUsername =
    req.nextUrl.searchParams.get('student_username')?.trim() ?? '';

  if (!/^[0-9]{5}$/.test(course_id) || !lab_uid.trim()) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Valid course_id (5 digits) and lab_uid required',
      } satisfies LabSubmissionsResponse),
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
    const username = String(verifyResponse.data.username);
    const isStudent = verifyResponse.data.student === true;
    const isInstructor = verifyResponse.data.instructor === true;
    const isTa = verifyResponse.data.ta === true;

    let targetUsername = username;
    let hasAccess = false;

    if (isStudent) {
      if (requestedStudentUsername && requestedStudentUsername !== username) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Students can only view their own submission history',
          } satisfies LabSubmissionsResponse),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      hasAccess = await hasCourseLabAccess(client, username, course_id, lab_uid);
    } else if (isInstructor || isTa) {
      if (!requestedStudentUsername) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'student_username is required for TA/instructor submission history lookups',
          } satisfies LabSubmissionsResponse),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const hasStaffAccess = await hasStaffCourseAccess(client, username, course_id);
      if (!hasStaffAccess) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'You do not have access to this course',
          } satisfies LabSubmissionsResponse),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      targetUsername = requestedStudentUsername;
      hasAccess = await hasCourseLabAccess(client, targetUsername, course_id, lab_uid);
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'You do not have permission to view submission history',
        } satisfies LabSubmissionsResponse),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'You do not have access to this lab',
        } satisfies LabSubmissionsResponse),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await client.query(
      `SELECT grade_session_id,
              grade,
              passed_tests,
              total_tests,
              passed,
              error_message,
              submitted_code,
              submitted_at
       FROM course_lab_submissions
       WHERE username = $1
         AND course_id = $2
         AND lab_uid = $3
       ORDER BY submitted_at DESC`,
      [targetUsername, course_id, lab_uid]
    );

    return new Response(
      JSON.stringify({
        success: true,
        submissions: result.rows.map((row: Record<string, unknown>) => ({
          gradeSessionId: String(row.grade_session_id),
          grade: Number(row.grade),
          passedTests: Number(row.passed_tests),
          totalTests: Number(row.total_tests),
          passed: Boolean(row.passed),
          errorMessage: row.error_message ? String(row.error_message) : null,
          submittedCode: String(row.submitted_code ?? ''),
          submittedAt: new Date(String(row.submitted_at)).toISOString(),
        })),
      } satisfies LabSubmissionsResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('lab_submissions GET:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load submission history',
      } satisfies LabSubmissionsResponse),
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

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data || !verifyResponse.data.username) {
    const modifiedCookie = await modifyCookieData({});

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid or missing authentication',
      } satisfies LabSubmissionsResponse),
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
        message: 'Only students can save submission history',
      } satisfies LabSubmissionsResponse),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = SaveLabSubmissionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid submission payload',
      } satisfies LabSubmissionsResponse),
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
    const username = String(verifyResponse.data.username);
    const {
      course_id,
      lab_uid,
      grade_session_id,
      code,
      grade,
      passed_tests,
      total_tests,
      passed,
      error_message,
    } = parsed.data;

    const hasAccess = await hasCourseLabAccess(client, username, course_id, lab_uid);
    if (!hasAccess) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'You do not have access to this lab',
        } satisfies LabSubmissionsResponse),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await client.query(
      `INSERT INTO course_lab_submissions (
          username,
          course_id,
          lab_uid,
          grade_session_id,
          submitted_code,
          grade,
          passed_tests,
          total_tests,
          passed,
          error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (username, course_id, lab_uid, grade_session_id) DO UPDATE
        SET submitted_code = EXCLUDED.submitted_code,
            grade = EXCLUDED.grade,
            passed_tests = EXCLUDED.passed_tests,
            total_tests = EXCLUDED.total_tests,
            passed = EXCLUDED.passed,
            error_message = EXCLUDED.error_message
        RETURNING grade_session_id,
                  grade,
                  passed_tests,
                  total_tests,
                  passed,
                  error_message,
                  submitted_code,
                  submitted_at`,
      [
        username,
        course_id,
        lab_uid,
        grade_session_id,
        code,
        grade,
        passed_tests,
        total_tests,
        passed,
        error_message ?? null,
      ]
    );

    const row = result.rows[0];

    return new Response(
      JSON.stringify({
        success: true,
        submission: {
          gradeSessionId: String(row.grade_session_id),
          grade: Number(row.grade),
          passedTests: Number(row.passed_tests),
          totalTests: Number(row.total_tests),
          passed: Boolean(row.passed),
          errorMessage: row.error_message ? String(row.error_message) : null,
          submittedCode: String(row.submitted_code ?? ''),
          submittedAt: new Date(String(row.submitted_at)).toISOString(),
        },
      } satisfies LabSubmissionsResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('lab_submissions POST:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save submission history',
      } satisfies LabSubmissionsResponse),
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
