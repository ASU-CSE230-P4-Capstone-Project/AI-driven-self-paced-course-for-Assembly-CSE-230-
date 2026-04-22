import { NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/backend-url";

type RunRequest = { 
  code: string;
  registers?: Record<string, string>;
  memory?: Record<string, string>; 
};
type RunResponse = {
  hadError: boolean;
  errorMessage: string;                 // "" if none
  states: Array<{
    registers: Record<string, string>; // register -> value
    memory: Record<string, string>;    // addr -> value
    labelName: string;
  }>;
};

const BACKEND_URL = getBackendUrl("/data");

export async function POST(req: Request) {
  let body: RunRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { hadError: true, errorMessage: "Invalid JSON", states: []} satisfies RunResponse,
      { status: 400 }
    );
  }

  const code = (body.code ?? "").trim();
  if (!code) {
    return NextResponse.json(
      { hadError: true, errorMessage: "No code provided.", states: [] } satisfies RunResponse,
      { status: 200 }
    );
  }

  // send to back end
  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        code,
        registers: body.registers ?? {},
        memory: body.memory ?? {},
       }),
    });
    if (!response.ok) {
      return NextResponse.json(
        { 
          hadError: true, 
          errorMessage: `Backend server error: ${response.status} ${response.statusText}`, 
          states: []
        } satisfies RunResponse,
        { status: 200 }
      );
    }

    const data: RunResponse = await response.json();
      console.log("Backend run successful");
       console.log(NextResponse.json(data, { status: 200 }));
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      { 
        hadError: true, 
        errorMessage: `Failed to connect to backend server: ${error instanceof Error ? error.message : String(error)}`, 
        states: []
      } satisfies RunResponse,
      { status: 200 }
    );
  }
}

// optional quick health check for GET /api/run
//export async function GET() {
 // return NextResponse.json({ ok: true, message: "/api/run connected to Python backend" });
//}
