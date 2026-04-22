import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';
import {
  getAssignedCourseLabTitle,
  getCourseLabRosterGradeRows,
  hasStaffCourseAccess,
} from './data';
import type { CourseLabRosterGradesResponse } from './types';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Only course staff can view roster grades',
      } satisfies CourseLabRosterGradesResponse),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const courseId = req.nextUrl.searchParams.get('course_id')?.trim() ?? '';
  const labUid = req.nextUrl.searchParams.get('lab_uid')?.trim() ?? '';

  if (!/^[0-9]{5}$/.test(courseId) || !labUid) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Valid course_id and lab_uid are required',
      } satisfies CourseLabRosterGradesResponse),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const viewerUsername = String(verifyResponse.data.username);
    const client = db.client;

    const hasAccess = await hasStaffCourseAccess(client, viewerUsername, courseId);
    if (!hasAccess) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'You are not assigned to this course',
        } satisfies CourseLabRosterGradesResponse),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const labTitle = await getAssignedCourseLabTitle(client, courseId, labUid);
    if (!labTitle) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'This lab is not assigned to the selected course',
        } satisfies CourseLabRosterGradesResponse),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const members = await getCourseLabRosterGradeRows(client, courseId, labUid);

    return new Response(
      JSON.stringify({
        success: true,
        labTitle,
        members,
      } satisfies CourseLabRosterGradesResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('course_lab_roster_grades GET:', error);

    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load roster grades',
      } satisfies CourseLabRosterGradesResponse),
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
