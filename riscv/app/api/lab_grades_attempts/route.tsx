import { NextRequest } from "next/server";
import { verifyCookieInternal } from "@/app/verify/internal";
import { DBConnection } from "@/app/sql/sql";
import { hasStaffCourseAccess } from "@/app/api/course_lab_roster_grades/data";
import { z } from "zod";
import { type LabGradesAttemptsResponse } from "./types";

const AttemptsQuerySchema = z.object({
  course_id: z.string().min(1),
  lab_uid: z.string().min(1),
  username: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response(
      JSON.stringify({ success: false, message: "Only course staff can view lab attempts" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const search = req.nextUrl.searchParams;
  const parsedQuery = AttemptsQuerySchema.safeParse({
    course_id: search.get("course_id") ?? "",
    lab_uid: search.get("lab_uid") ?? "",
    username: search.get("username") ?? "",
  });

  if (!parsedQuery.success) {
    return new Response(
      JSON.stringify({ success: false, message: "course_id, lab_uid, username are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { course_id, lab_uid, username } = parsedQuery.data;
  const courseId = String(course_id);
  const labUid = String(lab_uid);
  const studentUsername = String(username);

  let db: DBConnection | null = null;
  try {
    db = await DBConnection.create();
    const client = db.client;
    const viewerUsername = String(verifyResponse.data.username);

    const hasAccess = await hasStaffCourseAccess(client, viewerUsername, courseId);
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ success: false, message: "You are not assigned to this course" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure lab assigned to this course
    const assignedRes = await client.query(
      `SELECT 1
       FROM course_labs
       WHERE course_id = $1 AND lab_uid = $2`,
      [courseId, labUid]
    );
    if (assignedRes.rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "Lab not assigned to this course" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Total tests (points per test = 10)
    const testCountRes = await client.query(
      `SELECT COUNT(*)::int AS n FROM test_cases WHERE lab_uid = $1`,
      [labUid]
    );
    const testCaseCount = testCountRes.rows[0]?.n ?? 0;
    const maxScore = testCaseCount * 10;

    if (testCaseCount === 0) {
      const response: LabGradesAttemptsResponse = {
        success: true,
        labUid,
        memberUsername: studentUsername,
        testCaseCount,
        maxScore,
        attempts: [],
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tablesRes = await client.query(
      `SELECT
         (to_regclass('public.course_lab_submissions') IS NOT NULL) AS has_submissions,
         (to_regclass('public.grade_attempt_sessions') IS NOT NULL) AS has_sessions,
         (to_regclass('public.grade_test_case_results') IS NOT NULL) AS has_results`
    );
    const hasSubmissions = !!tablesRes.rows[0]?.has_submissions;
    const hasSessions = !!tablesRes.rows[0]?.has_sessions;
    const hasResults = !!tablesRes.rows[0]?.has_results;

    let attempts: LabGradesAttemptsResponse["attempts"] = [];

    if (hasResults) {
      let resolvedAttemptTimesSql = `SELECT NULL::text AS grade_session_id, NULL::timestamptz AS attempt_at WHERE FALSE`;

      if (hasSubmissions && hasSessions) {
        resolvedAttemptTimesSql = `
          WITH raw_attempt_times AS (
            SELECT
              grade_session_id,
              MAX(submitted_at)::timestamptz AS attempt_at
            FROM course_lab_submissions
            WHERE course_id = $3
              AND lab_uid = $1
              AND username = $2
            GROUP BY grade_session_id

            UNION ALL

            SELECT
              grade_session_id,
              created_at::timestamptz AS attempt_at
            FROM grade_attempt_sessions
            WHERE lab_uid = $1
              AND username = $2
          )
          SELECT
            grade_session_id,
            MAX(attempt_at) AS attempt_at
          FROM raw_attempt_times
          GROUP BY grade_session_id
        `;
      } else if (hasSubmissions) {
        resolvedAttemptTimesSql = `
          SELECT
            grade_session_id,
            MAX(submitted_at)::timestamptz AS attempt_at
          FROM course_lab_submissions
          WHERE course_id = $3
            AND lab_uid = $1
            AND username = $2
          GROUP BY grade_session_id
        `;
      } else if (hasSessions) {
        resolvedAttemptTimesSql = `
          SELECT
            grade_session_id,
            created_at::timestamptz AS attempt_at
          FROM grade_attempt_sessions
          WHERE lab_uid = $1
            AND username = $2
        `;
      }

      const attemptsRes = await client.query(
        `
        WITH tc AS (
          SELECT COUNT(*)::int AS n FROM test_cases WHERE lab_uid = $1
        ),
        resolved_attempt_times AS (
          ${resolvedAttemptTimesSql}
        ),
        sess AS (
          SELECT
            gtc.grade_session_id,
            rat.attempt_at,
            SUM(CASE WHEN gtc.pass THEN 1 ELSE 0 END)::int AS passed_tests,
            COUNT(*)::int AS result_rows,
            tc.n AS total_tests
          FROM grade_test_case_results gtc
          CROSS JOIN tc
          LEFT JOIN resolved_attempt_times rat
            ON rat.grade_session_id = gtc.grade_session_id
          WHERE gtc.lab_uid = $1
            AND gtc.username = $2
          GROUP BY gtc.grade_session_id, rat.attempt_at, tc.n
        ),
        complete AS (
          SELECT
            grade_session_id,
            attempt_at,
            passed_tests,
            total_tests,
            (passed_tests * 10)::int AS score
          FROM sess
          WHERE result_rows = total_tests
        )
        SELECT
          ROW_NUMBER() OVER (
            ORDER BY
              COALESCE(attempt_at, TIMESTAMPTZ '1970-01-01 00:00:00+00') ASC,
              grade_session_id ASC
          )::int AS attempt_number,
          grade_session_id,
          attempt_at,
          passed_tests,
          score,
          total_tests
        FROM complete
        ORDER BY
          attempt_at DESC NULLS LAST,
          grade_session_id DESC;
        `,
        [labUid, studentUsername, courseId]
      );

      attempts = attemptsRes.rows.map(
        (r: {
          attempt_number: number;
          grade_session_id: string;
          attempt_at: Date | string | null;
          passed_tests: number;
          score: number;
          total_tests: number;
        }) => ({
          attemptNumber: r.attempt_number,
          gradeSessionId: r.grade_session_id,
          gradedAt:
            r.attempt_at instanceof Date
              ? r.attempt_at.toISOString()
              : r.attempt_at
                ? String(r.attempt_at)
                : "",
          passedTests: r.passed_tests,
          score: r.score,
          maxScore,
          totalTests: r.total_tests,
        })
      );
    }

    const response: LabGradesAttemptsResponse = {
      success: true,
      labUid,
      memberUsername: studentUsername,
      testCaseCount,
      maxScore,
      attempts,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("lab_grades_attempts error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Failed to load attempts history",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
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
