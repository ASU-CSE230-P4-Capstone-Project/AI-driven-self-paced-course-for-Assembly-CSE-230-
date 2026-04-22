import { NextResponse } from "next/server";
import { modifyCookieData } from "@/app/verify/modify";
import { invalidateAuthSessionFromCookie } from "@/app/verify/session";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  await invalidateAuthSessionFromCookie(cookieHeader, "logout");
  const clearedCookie = await modifyCookieData({});

  return NextResponse.json(
    { success: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": clearedCookie,
      },
    }
  );
}
