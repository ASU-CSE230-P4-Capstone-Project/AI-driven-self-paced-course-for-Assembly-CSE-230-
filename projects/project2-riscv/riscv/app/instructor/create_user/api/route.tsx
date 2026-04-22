import { NextResponse } from "next/server";
import { CreateUserRequestSchema } from "./types";

import { DBConnection } from "@/app/sql/sql";
import { hashPassword, generateSalt } from "@/app/passwords";
import { verifyCookieInternal } from "@/app/verify/internal";
import { modifyCookieData } from "@/app/verify/modify";
import { ZodError } from "zod";

export async function POST(req: Request) {
  let db: DBConnection | null = null;
  
  try {
    // Verify the cookie to ensure user is authenticated
    const cookieHeader = req.headers.get('cookie') || '';
    const verifyResponse = await verifyCookieInternal(cookieHeader, {
      requireRecentAuth: true,
    });

    if (verifyResponse.reason === 'reauth_required') {
      return NextResponse.json(
        {
          success: false,
          message: "Please sign in again before creating users.",
        },
        { status: 401 }
      );
    }

    // Check that username is set and student boolean exists
    if (!verifyResponse.data || 
        !verifyResponse.data.username || 
        typeof verifyResponse.data.student === 'undefined') {
      const modifiedCookie = await modifyCookieData({});

      return NextResponse.json(
        {
          success: false,
          message: "Invalid or missing authentication",
        },
        { status: 401, headers: { 'Set-Cookie': modifiedCookie } }
      );
    }

    // Check that user is an instructor (student must be false)
    if (verifyResponse.data.instructor !== true) {
      return NextResponse.json(
        {
          success: false,
          message: "Only instructors can create users",
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedBody = CreateUserRequestSchema.parse(body);

    const { username, asuid, password, role } = validatedBody;
    const instructor = role === "instructor";

    // Get database connection
    db = await DBConnection.create();
    const client = db.client;

    // Generate 2000-character random salt (for database compatibility)
    const salt = generateSalt();

    // Hash password using Argon2id
    const passwordHash = await hashPassword(password);

    // Insert user into database
    await client.query(
      "INSERT INTO users (username, asuid, salt, password_hash, instructor) VALUES ($1, $2, $3, $4, $5)",
      [username, asuid, salt, passwordHash, instructor]
    );

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message:
          role === "ta"
            ? "TA user created successfully. Assign them as a TA in a course from Manage Roles before they can sign in through the admin portal."
            : "User created successfully",
      },
      { status: 201 }
    );

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request format: " + error.issues.map((issue) => issue.message).join(", "),
        },
        { status: 400 }
      );
    }

    // Handle database errors
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

    // Handle other errors
    console.error("Error creating user:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create user: " + errorMessage,
      },
      { status: 500 }
      );
  } finally {
    // Explicitly close database connection
    if (db) {
      try {
        await db.client.end();
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }
  }
}
