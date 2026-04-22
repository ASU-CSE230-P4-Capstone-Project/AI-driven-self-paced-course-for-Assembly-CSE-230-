import { NextRequest } from "next/server";
import { verifyCookieInternal } from "@/app/verify/internal";
import { modifyCookieData } from "@/app/verify/modify";
import { DBConnection } from "@/app/sql/sql";
import {
  UserSearchRequestSchema,
  UserSearchResponse,
} from "./types";

type RoleFilter = "any" | "student" | "instructor" | "ta";

export async function POST(req: NextRequest) {
  // Verify the cookie to ensure user is authenticated
  const cookieHeader = req.headers.get("cookie") || "";
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  // Check that username is set and student boolean exists
  if (
    !verifyResponse.data ||
    !verifyResponse.data.username ||
    typeof verifyResponse.data.student === "undefined"
  ) {
    // Unauthorized - clear cookies using modifyCookieData with empty object
    const modifiedCookie = await modifyCookieData({});

    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid or missing authentication",
      } satisfies UserSearchResponse),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": modifiedCookie,
        },
      }
    );
  }

  // Only instructors can search users
  if (verifyResponse.data.instructor !== true) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Only instructors can search users",
      } satisfies UserSearchResponse),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid request format",
      } satisfies UserSearchResponse),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const parsedBody = UserSearchRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid request payload",
      } satisfies UserSearchResponse),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const query = (parsedBody.data.query ?? "").trim();
  const role = (parsedBody.data.role ?? "any") as RoleFilter;
  const course = (parsedBody.data.course ?? "").trim();

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const client = db.client;

    const values: string[] = [];
    const addParam = (value: string) => {
      values.push(value);
      return `$${values.length}`;
    };

    let sql = "";

    if (course) {
      const courseParam = addParam(course);
      const courseLike = addParam(`%${course}%`);
      const filters = [
        `(cm.course_id = ${courseParam} OR c.code ILIKE ${courseLike} OR c.title ILIKE ${courseLike})`,
      ];

      if (query) {
        const queryParam = addParam(`%${query}%`);
        filters.push(`u.username ILIKE ${queryParam}`);
      }

      if (role !== "any") {
        const roleParam = addParam(role);
        filters.push(`cm.role = ${roleParam}`);
      }

      sql = `
        SELECT u.username, u.asuid, u.instructor, cm.role AS course_role, cm.course_id
        FROM users u
        JOIN course_memberships cm ON cm.username = u.username
        JOIN courses c ON c.course_id = cm.course_id
        WHERE ${filters.join(" AND ")}
        ORDER BY u.username ASC
      `;
    } else if (role === "ta") {
      const filters = [`cm.role = ${addParam("ta")}`];
      if (query) {
        const queryParam = addParam(`%${query}%`);
        filters.push(`u.username ILIKE ${queryParam}`);
      }

      sql = `
        SELECT DISTINCT u.username, u.asuid, u.instructor
        FROM users u
        JOIN course_memberships cm ON cm.username = u.username
        WHERE ${filters.join(" AND ")}
        ORDER BY u.username ASC
      `;
    } else {
      const filters: string[] = [];
      if (role === "instructor") {
        filters.push("u.instructor = true");
      } else if (role === "student") {
        filters.push("u.instructor = false");
      }

      if (query) {
        const queryParam = addParam(`%${query}%`);
        filters.push(`u.username ILIKE ${queryParam}`);
      }

      sql = `
        SELECT u.username, u.asuid, u.instructor
        FROM users u
        ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
        ORDER BY u.username ASC
      `;
    }

    type UserSearchRow = {
      username: string;
      asuid: string | null;
      instructor: unknown; // DB driver may return boolean / number / string
      course_id?: string | null;
      course_role?: string | null;
    };
    
    const result = await client.query(sql, values);
    
    const users = (result.rows as UserSearchRow[]).map((row) => ({
      username: row.username,
      asuid: row.asuid ?? null,
      instructor: Boolean(row.instructor),
      courseId: row.course_id ?? null,
      courseRole: row.course_role ?? null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        users,
      } satisfies UserSearchResponse),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("User search error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to search users: " + errorMessage,
      } satisfies UserSearchResponse),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } finally {
    if (db) {
      try {
        await db.client.end();
      } catch (closeError) {
        console.error("Error closing database connection:", closeError);
      }
    }
  }
}