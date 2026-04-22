import { NextRequest, NextResponse } from "next/server";
import { GradeStatusRequest, GradeStatusResponse } from "./types";
import { verifyCookieInternal } from "@/app/verify/internal";
import { modifyCookieData } from "@/app/verify/modify";
import { getBackendUrl } from "@/app/api/backend-url";

const BACKEND_URL = getBackendUrl("/grade_status");

export async function POST(req: NextRequest) {
  // Verify the cookie to ensure user is authenticated
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  // Check that username is set and student boolean exists
  if (!verifyResponse.data || 
      !verifyResponse.data.username || 
      typeof verifyResponse.data.student === 'undefined') {
    // Unauthorized - clear cookies using modifyCookieData with empty object
    const modifiedCookie = await modifyCookieData({});

    return new Response(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid or missing authentication',
      }),
      {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Set-Cookie': modifiedCookie,
        },
      }
    );
  }

  const username = String(verifyResponse.data.username);

  let body: GradeStatusRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" } satisfies GradeStatusResponse,
      { status: 400 }
    );
  }

  const course_id = (body.course_id ?? "").trim();
  const lab_uid = (body.lab_uid ?? "").trim();
  if (!/^[0-9]{5}$/.test(course_id)) {
    return NextResponse.json(
      { error: "Valid course_id (5 digits) required" } satisfies GradeStatusResponse,
      { status: 200 }
    );
  }

  if (!lab_uid) {
    return NextResponse.json(
      { error: "No lab_uid provided" } satisfies GradeStatusResponse,
      { status: 200 }
    );
  }

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ course_id, lab_uid, username }),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Backend server error: ${response.status} ${response.statusText}`,
        } satisfies GradeStatusResponse,
        { status: 200 }
      );
    }

    const data: GradeStatusResponse = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Failed to connect to backend server: ${
          error instanceof Error ? error.message : String(error)
        }`,
      } satisfies GradeStatusResponse,
      { status: 200 }
    );
  }
}
