import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { modifyCookieData } from '@/app/verify/modify';
import { DBConnection } from '@/app/sql/sql';
import type { LabSubmission } from '../lab_submissions/types';
import type { CourseLabSubmissionsOverviewResponse } from './types';

type OverviewRow = {
  username: string;
  total_submissions: number;
  highest_percent: number | string | null;
  submissions: LabSubmission[] | string | null;
};

async function verifyStaffAccess(
  client: DBConnection['client'],
  username: string,
  courseId: string
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1
     FROM course_memberships
     WHERE course_id = $1
       AND username = $2
       AND role IN ('instructor', 'ta')
       AND status = 'active'
     LIMIT 1`,
    [courseId, username]
  );

  return result.rows.length > 0;
}

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    const modifiedCookie = await modifyCookieData({});
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid or missing authentication',
      } satisfies CourseLabSubmissionsOverviewResponse),
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

  if (!/^[0-9]{5}$/.test(course_id) || !lab_uid.trim()) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Valid course_id (5 digits) and lab_uid are required',
      } satisfies CourseLabSubmissionsOverviewResponse),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const client = db.client;
    const username = String(verifyResponse.data.username);
    const hasAccess = await verifyStaffAccess(client, username, course_id);

    if (!hasAccess) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'You are not assigned to this course',
        } satisfies CourseLabSubmissionsOverviewResponse),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const labResult = await client.query(
      `SELECT l.title
       FROM course_labs cl
       JOIN labs l ON l.uid = cl.lab_uid
       WHERE cl.course_id = $1
         AND cl.lab_uid = $2
       LIMIT 1`,
      [course_id, lab_uid]
    );

    if (labResult.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'This lab is not assigned to the selected course',
        } satisfies CourseLabSubmissionsOverviewResponse),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await client.query<OverviewRow>(
      `SELECT cm.username,
              COALESCE(stats.total_submissions, 0)::int AS total_submissions,
              stats.highest_percent,
              COALESCE(
                json_agg(
                  json_build_object(
                    'gradeSessionId', recent.grade_session_id,
                    'grade', recent.grade,
                    'passedTests', recent.passed_tests,
                    'totalTests', recent.total_tests,
                    'passed', recent.passed,
                    'errorMessage', recent.error_message,
                    'submittedCode', recent.submitted_code,
                    'submittedAt', recent.submitted_at
                  )
                  ORDER BY recent.submitted_at DESC
                ) FILTER (WHERE recent.grade_session_id IS NOT NULL),
                '[]'::json
              ) AS submissions
       FROM course_memberships cm
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total_submissions,
                MAX(cls_all.grade)::numeric(5,2) AS highest_percent
         FROM course_lab_submissions cls_all
         WHERE cls_all.username = cm.username
           AND cls_all.course_id = $1
           AND cls_all.lab_uid = $2
       ) stats ON TRUE
       LEFT JOIN LATERAL (
         SELECT grade_session_id,
                grade,
                passed_tests,
                total_tests,
                passed,
                error_message,
                submitted_code,
                submitted_at
         FROM course_lab_submissions cls
         WHERE cls.username = cm.username
           AND cls.course_id = $1
           AND cls.lab_uid = $2
         ORDER BY submitted_at DESC
         LIMIT 5
       ) recent ON TRUE
       WHERE cm.course_id = $1
         AND cm.role = 'student'
         AND cm.status = 'active'
       GROUP BY cm.username, stats.total_submissions, stats.highest_percent
       ORDER BY cm.username`,
      [course_id, lab_uid]
    );

    const students = result.rows.map((row: OverviewRow) => ({
      username: row.username,
      highestPercent:
        row.highest_percent === null ? null : Number(row.highest_percent),
      totalSubmissions: Number(row.total_submissions ?? 0),
      submissions:
        typeof row.submissions === 'string'
          ? (JSON.parse(row.submissions) as LabSubmission[])
          : ((row.submissions ?? []) as LabSubmission[]),
    }));
    const gradedStudents = students.filter((student) => student.highestPercent !== null);
    const averageHighestPercent =
      gradedStudents.length > 0
        ? Number(
            (
              gradedStudents.reduce(
                (sum, student) => sum + Number(student.highestPercent ?? 0),
                0
              ) / gradedStudents.length
            ).toFixed(2)
          )
        : null;

    return new Response(
      JSON.stringify({
        success: true,
        labTitle: String(labResult.rows[0].title ?? ''),
        averageHighestPercent,
        gradedStudentCount: gradedStudents.length,
        students,
      } satisfies CourseLabSubmissionsOverviewResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('course_lab_submissions_overview GET:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to load lab submissions overview',
      } satisfies CourseLabSubmissionsOverviewResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (db) {
      try {
        await db.client.end();
      } catch {}
    }
  }
}
