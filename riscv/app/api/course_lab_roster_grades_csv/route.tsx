import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';
import {
  getAssignedCourseLabTitle,
  hasStaffCourseAccess,
} from '@/app/api/course_lab_roster_grades/data';
import { formatUserDisplayName } from '@/app/lib/format-user-display-name';

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function formatGradeForCsv(grade: number): string {
  return Number.isInteger(grade) ? String(grade) : grade.toFixed(2);
}

type CsvRosterRow = {
  username: string;
  asuid: string | null;
  best_score: number | string | null;
  latest_submitted_at: Date | string | null;
};

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response('Only course staff can export roster grades', { status: 403 });
  }

  const courseId = req.nextUrl.searchParams.get('course_id')?.trim() ?? '';
  const labUid = req.nextUrl.searchParams.get('lab_uid')?.trim() ?? '';

  if (!/^[0-9]{5}$/.test(courseId) || !labUid) {
    return new Response('Valid course_id and lab_uid are required', { status: 400 });
  }

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const viewerUsername = String(verifyResponse.data.username);
    const client = db.client;

    const hasAccess = await hasStaffCourseAccess(client, viewerUsername, courseId);
    if (!hasAccess) {
      return new Response('You are not assigned to this course', { status: 403 });
    }

    const labTitle = await getAssignedCourseLabTitle(client, courseId, labUid);
    if (!labTitle) {
      return new Response('This lab is not assigned to the selected course', { status: 404 });
    }

    const membersResult = await client.query<CsvRosterRow>(
      `SELECT
         cm.username,
         u.asuid,
         MAX(cls.grade)::numeric(5,2) AS best_score,
         MAX(cls.submitted_at)::timestamptz AS latest_submitted_at
       FROM course_memberships cm
       JOIN users u ON u.username = cm.username
       LEFT JOIN course_lab_submissions cls
         ON cls.username = cm.username
        AND cls.course_id = cm.course_id
        AND cls.lab_uid = $2
       WHERE cm.course_id = $1
         AND cm.role = 'student'
         AND cm.status = 'active'
       GROUP BY cm.username, u.asuid
       ORDER BY cm.username ASC`,
      [courseId, labUid]
    );

    const members = membersResult.rows.map((row) => ({
      username: row.username,
      asuid: row.asuid?.trim() ?? '',
      name: formatUserDisplayName(row.username),
      bestScore:
        typeof row.best_score === 'number'
          ? row.best_score
          : row.best_score === null
            ? null
            : Number(row.best_score),
      latestSubmittedAt: row.latest_submitted_at
        ? row.latest_submitted_at instanceof Date
          ? row.latest_submitted_at.toISOString()
          : String(row.latest_submitted_at)
        : '',
    }));

    const lines = [
      [
        'course_id',
        'lab_uid',
        'lab_name',
        'username',
        'asuid',
        'name',
        'score',
        'timestamp',
      ].join(','),
      ...members.map((member) =>
        [
          escapeCsvCell(courseId),
          escapeCsvCell(labUid),
          escapeCsvCell(labTitle),
          escapeCsvCell(member.username),
          escapeCsvCell(member.asuid),
          escapeCsvCell(member.name),
          member.bestScore === null ? '' : formatGradeForCsv(member.bestScore),
          member.latestSubmittedAt ? escapeCsvCell(member.latestSubmittedAt) : '',
        ].join(',')
      ),
    ];

    return new Response(lines.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="course-${courseId}-lab-${labUid}-roster-grades.csv"`,
      },
    });
  } catch (error: unknown) {
    console.error('course_lab_roster_grades_csv GET:', error);
    return new Response(
      error instanceof Error ? error.message : 'Failed to export roster grades CSV',
      { status: 500 }
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
