import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { modifyCookieData } from '@/app/verify/modify';
import { DBConnection } from '@/app/sql/sql';
import { parsePersistedInputOverrides } from '@/components/input-overrides';
import type { LabSession } from '../load_lab_session/types';
import type { StudentLabContextResponse } from './types';

type StudentLabContextRow = {
  lab_uid: string | null;
  lab_title: string | null;
  md: string | null;
  session_uid: string | null;
  session_lab_uid: string | null;
  version: number | null;
  code: string | null;
  resp: unknown;
  sim_state: unknown;
  step_index: number | null;
  all_states: unknown;
  register_overrides: unknown;
};

async function hasStudentLabAccess(
  client: DBConnection['client'],
  username: string,
  courseId: string,
  labUid: string
): Promise<boolean> {
  const result = await client.query(
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

  return result.rows.length > 0;
}

async function hasStaffCourseAccess(
  client: DBConnection['client'],
  username: string,
  courseId: string
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1
     FROM course_memberships
     WHERE username = $1
       AND course_id = $2
       AND role IN ('ta', 'instructor')
       AND status = 'active'
     LIMIT 1`,
    [username, courseId]
  );

  return result.rows.length > 0;
}

function buildSession(
  storageKey: string,
  row: StudentLabContextRow
): LabSession | null {
  if (!row.session_uid) {
    return null;
  }

  const overrides = parsePersistedInputOverrides(row.register_overrides);

  return {
    storageKey,
    uid: row.session_uid,
    labUid: row.session_lab_uid ?? null,
    version: typeof row.version === 'number' ? row.version : 1,
    code: row.code ?? '',
    resp: (row.resp ?? null) as LabSession['resp'],
    simState: (row.sim_state ?? null) as LabSession['simState'],
    stepIndex: typeof row.step_index === 'number' ? row.step_index : 0,
    allStates: (Array.isArray(row.all_states) ? row.all_states : []) as LabSession['allStates'],
    registerOverrides: overrides.registerOverrides,
    memoryOverrides: overrides.memoryOverrides,
  };
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
      } satisfies StudentLabContextResponse),
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
  const storage_key = req.nextUrl.searchParams.get('storage_key') ?? '';
  const requestedStudentUsername =
    req.nextUrl.searchParams.get('student_username')?.trim() ?? '';

  if (!/^[0-9]{5}$/.test(course_id) || !lab_uid.trim() || !storage_key.trim()) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Valid course_id, lab_uid, and storage_key are required',
      } satisfies StudentLabContextResponse),
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
    const viewerUsername = String(verifyResponse.data.username);
    const isStudent = verifyResponse.data.student === true;
    const isInstructor = verifyResponse.data.instructor === true;
    const isTa = verifyResponse.data.ta === true;

    let targetUsername = viewerUsername;

    if (isStudent) {
      if (requestedStudentUsername && requestedStudentUsername !== viewerUsername) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Students can only view their own lab context',
          } satisfies StudentLabContextResponse),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const hasAccess = await hasStudentLabAccess(client, viewerUsername, course_id, lab_uid);
      if (!hasAccess) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'You are not enrolled in this course',
          } satisfies StudentLabContextResponse),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    } else if (isInstructor || isTa) {
      if (!requestedStudentUsername) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'student_username is required for TA/instructor lab review',
          } satisfies StudentLabContextResponse),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const hasStaffAccess = await hasStaffCourseAccess(client, viewerUsername, course_id);
      if (!hasStaffAccess) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'You do not have access to this course',
          } satisfies StudentLabContextResponse),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const hasStudentAccess = await hasStudentLabAccess(
        client,
        requestedStudentUsername,
        course_id,
        lab_uid
      );
      if (!hasStudentAccess) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'The selected student does not have access to this lab',
          } satisfies StudentLabContextResponse),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      targetUsername = requestedStudentUsername;
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'You do not have permission to view student lab context',
        } satisfies StudentLabContextResponse),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await client.query<StudentLabContextRow>(
      `SELECT l.uid AS lab_uid,
              l.title AS lab_title,
              l.md,
              ls.uid AS session_uid,
              ls.lab_uid AS session_lab_uid,
              ls.version,
              ls.code,
              ls.resp,
              ls.sim_state,
              ls.step_index,
              ls.all_states,
              ls.register_overrides
       FROM course_memberships cm
       LEFT JOIN course_labs cl
         ON cl.course_id = cm.course_id
        AND cl.lab_uid = $3
       LEFT JOIN labs l
         ON l.uid = cl.lab_uid
       LEFT JOIN lab_sessions ls
         ON ls.username = cm.username
        AND ls.storage_key = $4
       WHERE cm.username = $1
         AND cm.course_id = $2
         AND cm.role = 'student'
         AND cm.status = 'active'
       LIMIT 1`,
      [targetUsername, course_id, lab_uid, storage_key]
    );

    if (result.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'You are not enrolled in this course',
        } satisfies StudentLabContextResponse),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const row = result.rows[0];

    if (!row.lab_uid || !row.lab_title || row.md === null) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'This lab is not assigned to the selected course',
        } satisfies StudentLabContextResponse),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        lab: {
          uid: row.lab_uid,
          title: row.lab_title,
          md: row.md,
        },
        session: buildSession(storage_key, row),
      } satisfies StudentLabContextResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('student_lab_context GET:', error);

    return new Response(
      JSON.stringify({
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to load lab context',
      } satisfies StudentLabContextResponse),
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
