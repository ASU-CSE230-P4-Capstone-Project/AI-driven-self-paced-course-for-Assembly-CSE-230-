import type { DBClient } from '@/app/sql/sql';
import { formatUserDisplayName } from '@/app/lib/format-user-display-name';

export type CourseLabRosterGradeDataRow = {
  username: string;
  asuid: string;
  name: string;
  grade: number;
};

export async function hasStaffCourseAccess(
  client: DBClient,
  viewerUsername: string,
  courseId: string
): Promise<boolean> {
  const membershipResult = await client.query(
    `SELECT 1
     FROM course_memberships
     WHERE course_id = $1
       AND username = $2
       AND role IN ('instructor', 'ta')
       AND status = 'active'
     LIMIT 1`,
    [courseId, viewerUsername]
  );

  return membershipResult.rows.length > 0;
}

export async function getAssignedCourseLabTitle(
  client: DBClient,
  courseId: string,
  labUid: string
): Promise<string | null> {
  const assignedResult = await client.query(
    `SELECT l.title
     FROM course_labs cl
     JOIN labs l ON l.uid = cl.lab_uid
     WHERE cl.course_id = $1
       AND cl.lab_uid = $2
     LIMIT 1`,
    [courseId, labUid]
  );

  if (assignedResult.rows.length === 0) {
    return null;
  }

  return String(assignedResult.rows[0].title ?? '');
}

export async function getCourseLabRosterGradeRows(
  client: DBClient,
  courseId: string,
  labUid: string
): Promise<CourseLabRosterGradeDataRow[]> {
  const result = await client.query(
    `SELECT
       cm.username,
       u.asuid,
       COALESCE(MAX(cls.grade), 0)::numeric(5,2) AS grade
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

  return result.rows.map((row: { username: string; asuid: string; grade: number | string }) => ({
    username: row.username,
    asuid: row.asuid,
    name: formatUserDisplayName(row.username),
    grade: Number(row.grade ?? 0),
  }));
}
