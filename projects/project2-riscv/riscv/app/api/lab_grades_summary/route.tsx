import { NextRequest } from "next/server";
import { verifyCookieInternal } from "@/app/verify/internal";
import { DBConnection } from "@/app/sql/sql";
import { hasStaffCourseAccess } from "@/app/api/course_lab_roster_grades/data";
import { z } from "zod";
import { type LabGradesSummaryResponse } from "./types";

const SummaryQuerySchema = z.object({
  course_id: z.string().min(1),
  lab_uid: z.string().min(1),
});

type CourseMemberRow = { username: string; role: string };

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data?.username || verifyResponse.data.student !== false) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Only course staff can view lab grades",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const search = req.nextUrl.searchParams;
  const parsedQuery = SummaryQuerySchema.safeParse({
    course_id: search.get("course_id") ?? "",
    lab_uid: search.get("lab_uid") ?? "",
  });

  if (!parsedQuery.success) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "course_id and lab_uid are required",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { course_id, lab_uid } = parsedQuery.data;

  const courseId = String(course_id);
  const labUid = String(lab_uid);

  let db: DBConnection | null = null;
  try {
    db = await DBConnection.create();
    const client = db.client;
    const viewerUsername = String(verifyResponse.data.username);

    const hasAccess = await hasStaffCourseAccess(client, viewerUsername, courseId);
    if (!hasAccess) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "You are not assigned to this course",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure this lab is assigned to the course.
    const assignedRes = await client.query(
      `SELECT 1
       FROM course_labs
       WHERE course_id = $1 AND lab_uid = $2`,
      [courseId, labUid]
    );
    if (assignedRes.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Lab not assigned to this course",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const testCountRes = await client.query(
      `SELECT COUNT(*)::int AS n
       FROM test_cases
       WHERE lab_uid = $1`,
      [labUid]
    );
    const testCaseCount = testCountRes.rows[0]?.n ?? 0;
    const maxScore = testCaseCount * 10;

    const tablesRes = await client.query(
      `SELECT
         (to_regclass('public.grade_attempts') IS NOT NULL) AS has_attempts,
         (to_regclass('public.grade_test_case_results') IS NOT NULL) AS has_results
       `
    );
    const hasAttempts = !!tablesRes.rows[0]?.has_attempts;
    const hasResults = !!tablesRes.rows[0]?.has_results;

    const membersRes = await client.query(
      `SELECT username, role
       FROM course_memberships
       WHERE course_id = $1
         AND status = 'active'
         AND role = 'student'
       ORDER BY username`,
      [courseId]
    );

    const members: CourseMemberRow[] = membersRes.rows.map((r: { username: string; role: string }) => ({
      username: r.username,
      role: r.role,
    }));

    const usernames = members.map((m) => m.username);

    // Attempts used (defaults to 0)
    const attemptsMap = new Map<string, number>();
    if (usernames.length > 0) {
      if (hasAttempts) {
        const attemptsRes = await client.query(
          `SELECT username, attempts_used::int AS attempts_used
           FROM grade_attempts
           WHERE lab_uid = $1
             AND username = ANY($2::text[])`,
          [labUid, usernames]
        );
        for (const row of attemptsRes.rows) {
          attemptsMap.set(row.username, row.attempts_used);
        }
      }
    }

    // Best score: compute complete grade sessions (all test cases present),
    // then take max passed_tests*10 per user.
    const bestRows: Array<{ username: string; best_score: number | null }> = [];
    if (usernames.length > 0 && testCaseCount > 0 && hasResults) {
      const bestRes = await client.query(
        `
        WITH tc AS (
          SELECT COUNT(*)::int AS n FROM test_cases WHERE lab_uid = $1
        ),
        sess AS (
          SELECT
            username,
            grade_session_id,
            SUM(CASE WHEN pass THEN 1 ELSE 0 END)::int AS passed_tests,
            COUNT(*)::int AS result_rows
          FROM grade_test_case_results
          WHERE lab_uid = $1
            AND username = ANY($2::text[])
          GROUP BY username, grade_session_id
        ),
        complete AS (
          SELECT username, grade_session_id,
                 (passed_tests * 10)::int AS score
          FROM sess
          CROSS JOIN tc
          WHERE sess.result_rows = tc.n
        )
        SELECT username,
               score AS best_score
        FROM (
          SELECT *,
                 ROW_NUMBER() OVER (
                   PARTITION BY username
                   ORDER BY score DESC, grade_session_id ASC
                 ) AS rn
          FROM complete
        ) x
        WHERE rn = 1;
        `,
        [labUid, usernames]
      );
      for (const row of bestRes.rows) {
        bestRows.push({ username: row.username, best_score: row.best_score });
      }
    }

    const bestMap = new Map<string, number | null>();
    for (const r of bestRows) bestMap.set(r.username, r.best_score);

    const response: LabGradesSummaryResponse = {
      success: true,
      testCaseCount,
      maxScore,
      members: members.map((m) => ({
        ...m,
        attemptsUsed: attemptsMap.get(m.username) ?? 0,
        bestScore: bestMap.get(m.username) ?? null,
      })),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("lab_grades_summary error:", error);
    const response = {
      success: false,
      message: error instanceof Error ? error.message : "Failed to load lab grades",
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
