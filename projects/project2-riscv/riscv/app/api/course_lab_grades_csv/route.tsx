import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { modifyCookieData } from '@/app/verify/modify';
import { DBConnection } from '@/app/sql/sql';

type CsvRow = {
  username: string;
  grade: number | null;
  passed_tests: number | null;
  total_tests: number | null;
  passed: boolean | null;
  submitted_at: string | Date | null;
};

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Set-Cookie': modifiedCookie },
    });
  }

  const course_id = req.nextUrl.searchParams.get('course_id') ?? '';
  const lab_uid = req.nextUrl.searchParams.get('lab_uid') ?? '';

  if (!/^[0-9]{5}$/.test(course_id) || !lab_uid.trim()) {
    return new Response('Valid course_id (5 digits) and lab_uid are required', {
      status: 400,
    });
  }

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const client = db.client;
    const username = String(verifyResponse.data.username);
    const hasAccess = await verifyStaffAccess(client, username, course_id);

    if (!hasAccess) {
      return new Response('You are not assigned to this course', { status: 403 });
    }

    const rowsResult = await client.query<CsvRow>(
      `SELECT cm.username,
              latest.grade,
              latest.passed_tests,
              latest.total_tests,
              latest.passed,
              latest.submitted_at
       FROM course_memberships cm
       LEFT JOIN LATERAL (
         SELECT grade,
                passed_tests,
                total_tests,
                passed,
                submitted_at
         FROM course_lab_submissions cls
         WHERE cls.username = cm.username
           AND cls.course_id = $1
           AND cls.lab_uid = $2
         ORDER BY submitted_at DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE cm.course_id = $1
         AND cm.role = 'student'
         AND cm.status = 'active'
       ORDER BY cm.username`,
      [course_id, lab_uid]
    );

    const lines = [
      ['username', 'grade', 'passed_tests', 'total_tests', 'passed', 'submitted_at'].join(','),
      ...rowsResult.rows.map((row: CsvRow) =>
        [
          escapeCsvCell(row.username),
          row.grade === null ? '' : String(row.grade),
          row.passed_tests === null ? '' : String(row.passed_tests),
          row.total_tests === null ? '' : String(row.total_tests),
          row.passed === null ? '' : String(row.passed),
          row.submitted_at
            ? escapeCsvCell(
                row.submitted_at instanceof Date
                  ? row.submitted_at.toISOString()
                  : String(row.submitted_at)
              )
            : '',
        ].join(',')
      ),
    ];

    return new Response(lines.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="course-${course_id}-lab-${lab_uid}-grades.csv"`,
      },
    });
  } catch (error: unknown) {
    console.error('course_lab_grades_csv GET:', error);
    return new Response(
      error instanceof Error ? error.message : 'Failed to export grades CSV',
      { status: 500 }
    );
  } finally {
    if (db) {
      try {
        await db.client.end();
      } catch {}
    }
  }
}
