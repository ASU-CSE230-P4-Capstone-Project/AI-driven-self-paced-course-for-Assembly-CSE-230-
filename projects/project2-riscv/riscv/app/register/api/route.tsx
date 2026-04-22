import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DBConnection } from "@/app/sql/sql";
import { generateSalt, hashPassword } from "@/app/passwords";
import { RegisterRequestSchema } from "./types";

export async function POST(req: Request) {
  let db: DBConnection | null = null;

  try {
    const body = await req.json();
    const validatedBody = RegisterRequestSchema.parse(body);
    const { username, asuid, password } = validatedBody;

    db = await DBConnection.create();
    const client = db.client;

    const salt = generateSalt();
    const passwordHash = await hashPassword(password);

    await client.query(
      "INSERT INTO users (username, asuid, salt, password_hash, instructor) VALUES ($1, $2, $3, $4, false)",
      [username, asuid, salt, passwordHash]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Account created. Sign in through Student Login.",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request: " + error.issues.map((issue) => issue.message).join(", "),
        },
        { status: 400 }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Username or ASU ID already exists",
        },
        { status: 409 }
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create account: " +
          (error instanceof Error ? error.message : "Unknown error"),
      },
      { status: 500 }
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
