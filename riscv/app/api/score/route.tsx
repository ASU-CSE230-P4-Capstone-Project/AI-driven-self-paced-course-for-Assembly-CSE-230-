import { NextRequest, NextResponse } from "next/server";
import { ScoreRequest, ScoreResponse } from "./types";
import { verifyCookieInternal } from "@/app/verify/internal";
import { modifyCookieData } from "@/app/verify/modify";
import { getBackendUrl } from "@/app/api/backend-url";

const BACKEND_URL = getBackendUrl("/score");

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

  let body: ScoreRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { pass: false, error: "Invalid JSON" } satisfies ScoreResponse,
      { status: 400 }
    );
  }

  const code = (body.code ?? "").trim();
  const course_id = (body.course_id ?? "").trim();
  const test_uid = (body.test_uid ?? "").trim();
  const grade_session_id = (body.grade_session_id ?? "").trim();

  if (!code) {
    return NextResponse.json(
      { pass: false, error: "No code provided" } satisfies ScoreResponse,
      { status: 200 }
    );
  }

  if (!/^[0-9]{5}$/.test(course_id)) {
    return NextResponse.json(
      { pass: false, error: "Valid course_id (5 digits) required" } satisfies ScoreResponse,
      { status: 200 }
    );
  }

  if (!test_uid) {
    return NextResponse.json(
      { pass: false, error: "No test_uid provided" } satisfies ScoreResponse,
      { status: 200 }
    );
  }

  // Send to Python backend
  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        code, 
        course_id,
        test_uid, 
        grade_session_id: grade_session_id || undefined, 
        username,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { 
          pass: false, 
          error: `Backend server error: ${response.status} ${response.statusText}` 
        } satisfies ScoreResponse,
        { status: 200 }
      );
    }

    const data: ScoreResponse = await response.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      { 
        pass: false, 
        error: `Failed to connect to backend server: ${error instanceof Error ? error.message : String(error)}` 
      } satisfies ScoreResponse,
      { status: 200 }
    );
  }
}
