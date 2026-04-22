import { headers } from 'next/headers';
import { DBConnection } from '@/app/sql/sql';
import type { StudentCourse } from '@/app/api/student_courses/types';
import type { StudentCourseLab } from '@/app/api/student_course_labs/types';
import { readVerifiedRequestAuth } from '@/app/verify/request-auth';
import StudentLabsClient from './client';

type StudentLabsPageProps = {
  searchParams?: Promise<{ course_id?: string | string[] | undefined }>;
};

type StudentLabsSearchParams = {
  course_id?: string | string[] | undefined;
};

type StudentCourseRow = {
  course_id: string;
  code: string;
  title: string;
  term: string | null;
};

type StudentCourseLabRow = {
  uid: string;
  title: string;
  md: string;
};

function getSingleSearchParam(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export default async function StudentLabsPage({
  searchParams,
}: StudentLabsPageProps) {
  const resolvedSearchParams: StudentLabsSearchParams = await (
    searchParams ?? Promise.resolve({} as StudentLabsSearchParams)
  );
  const requestedCourseId = getSingleSearchParam(
    resolvedSearchParams.course_id
  ).trim();

  let courses: StudentCourse[] = [];
  let labs: StudentCourseLab[] = [];
  let selectedCourseId = '';
  let coursesError: string | null = null;
  let labsError: string | null = null;

  const headerStore = await headers();
  const auth = readVerifiedRequestAuth(headerStore);

  if (!auth?.username) {
    coursesError = 'Invalid or missing authentication';

    return (
      <StudentLabsClient
        courses={courses}
        labs={labs}
        selectedCourseId={selectedCourseId}
        coursesError={coursesError}
        labsError={labsError}
      />
    );
  }

  if (auth.student !== true) {
    coursesError = 'Only students can view labs';

    return (
      <StudentLabsClient
        courses={courses}
        labs={labs}
        selectedCourseId={selectedCourseId}
        coursesError={coursesError}
        labsError={labsError}
      />
    );
  }

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const username = auth.username;

    const coursesResult = await db.client.query<StudentCourseRow>(
      `SELECT c.course_id, c.code, c.title, c.term
       FROM course_memberships cm
       JOIN courses c ON c.course_id = cm.course_id
       WHERE cm.username = $1
         AND cm.role = 'student'
         AND cm.status = 'active'
       ORDER BY c.code ASC, c.term ASC NULLS LAST, c.title ASC`,
      [username]
    );

    courses = coursesResult.rows.map((row: StudentCourseRow) => ({
      course_id: row.course_id,
      code: row.code,
      title: row.title,
      term: row.term ?? null,
    }));

    if (
      /^[0-9]{5}$/.test(requestedCourseId) &&
      courses.some((course) => course.course_id === requestedCourseId)
    ) {
      selectedCourseId = requestedCourseId;

      const labsResult = await db.client.query<StudentCourseLabRow>(
        `SELECT l.uid, l.title, l.md
         FROM course_memberships cm
         JOIN course_labs cl ON cl.course_id = cm.course_id
         JOIN labs l ON l.uid = cl.lab_uid
         WHERE cm.username = $1
           AND cm.course_id = $2
           AND cm.role = 'student'
           AND cm.status = 'active'
         ORDER BY cl.position ASC, l.title ASC`,
        [username, selectedCourseId]
      );

      labs = labsResult.rows.map((row: StudentCourseLabRow) => ({
        uid: row.uid,
        title: row.title,
        md: row.md,
      }));
    }
  } catch (error: unknown) {
    if (courses.length > 0) {
      labsError =
        error instanceof Error ? error.message : 'Failed to load labs for this course';
    } else {
      coursesError =
        error instanceof Error ? error.message : 'Failed to load student courses';
    }
  } finally {
    if (db) {
      try {
        await db.client.end();
      } catch {}
    }
  }

  return (
    <StudentLabsClient
      courses={courses}
      labs={labs}
      selectedCourseId={selectedCourseId}
      coursesError={coursesError}
      labsError={labsError}
    />
  );
}
