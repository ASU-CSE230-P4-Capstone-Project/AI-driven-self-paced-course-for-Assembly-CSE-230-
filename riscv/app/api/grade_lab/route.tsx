import { NextRequest, NextResponse } from "next/server";
import { verifyCookieInternal } from "@/app/verify/internal";
import { modifyCookieData } from "@/app/verify/modify";
import { getBackendUrl } from "@/app/api/backend-url";
import {
  GradeLabRequestSchema,
  type GradeLabResponse,
} from "./types";

const BACKEND_URL = getBackendUrl("/grade_lab");

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (
    !verifyResponse.data ||
    !verifyResponse.data.username ||
    typeof verifyResponse.data.student === "undefined"
  ) {
    const modifiedCookie = await modifyCookieData({});

    return new Response(
      JSON.stringify({
        pass: false,
        error: "Unauthorized",
        message: "Invalid or missing authentication",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": modifiedCookie,
        },
      }
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { pass: false, error: "Invalid JSON" } satisfies GradeLabResponse,
      { status: 400 }
    );
  }

  const parsed = GradeLabRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { pass: false, error: "Invalid request payload" } satisfies GradeLabResponse,
      { status: 400 }
    );
  }

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: parsed.data.code,
        course_id: parsed.data.course_id,
        lab_uid: parsed.data.lab_uid,
        grade_session_id: parsed.data.grade_session_id || undefined,
        username: String(verifyResponse.data.username),
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          pass: false,
          error: `Backend server error: ${response.status} ${response.statusText}`,
        } satisfies GradeLabResponse,
        { status: 200 }
      );
    }

    const data: GradeLabResponse = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        pass: false,
        error: `Failed to connect to backend server: ${error instanceof Error ? error.message : String(error)}`,
      } satisfies GradeLabResponse,
      { status: 200 }
    );
  }
}
