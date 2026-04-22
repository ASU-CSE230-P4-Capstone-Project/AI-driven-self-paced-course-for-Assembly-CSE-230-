import { NextRequest } from 'next/server';
import { LoginRequestSchema } from './types';
import { DBConnection, type DBClient } from '@/app/sql/sql';
import { verifyPassword } from '@/app/passwords';
import {
  modifyCookieData,
} from '@/app/verify/modify';
import { invalidateAuthSessionFromCookie } from '@/app/verify/session';

type LoginUserRow = {
  username: string;
  password_hash: string;
  instructor: boolean | null;
  has_active_ta_role?: boolean;
};

export async function POST(req: NextRequest) {
  let db: DBConnection | null = null;
  let client: DBClient | null = null;
  const cookieHeader = req.headers.get('cookie') || '';

  const getModifiedCookie = async (newData: Record<string, unknown>): Promise<string> =>
    modifyCookieData(newData, client ?? undefined);
  
  try {
    // Parse and validate request body
    const body = await req.json();
    const parsedBody = LoginRequestSchema.safeParse(body);
    
    if (!parsedBody.success) {
      // Invalid request format. Use modifyCookieData with empty object to clear cookie
      const modifiedCookie = await getModifiedCookie({});

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request format',
        }),
        {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Set-Cookie': modifiedCookie,
          },
        }
      );
    }

    const { username, password } = parsedBody.data;
    const portal = parsedBody.data.portal ?? 'student';

    // Get database connection
    db = await DBConnection.create();
    client = db.client;

    let userResult;
    try {
      userResult = await client.query<LoginUserRow>(
        `
        SELECT
          u.username,
          u.password_hash,
          u.instructor,
          EXISTS (
            SELECT 1
            FROM course_memberships cm
            WHERE cm.username = u.username
              AND cm.role = 'ta'
              AND cm.status = 'active'
          ) AS has_active_ta_role
        FROM users u
        WHERE u.username = $1
        `,
        [username]
      );
    } catch (taLookupError) {
      console.warn('TA role lookup skipped:', taLookupError);
      userResult = await client.query<LoginUserRow>(
        "SELECT username, password_hash, instructor FROM users WHERE username = $1",
        [username]
      );
    }

    if (userResult.rows.length === 0) {
      // Username not found. Use modifyCookieData with empty object to clear cookie
      const modifiedCookie = await getModifiedCookie({});

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Username not found',
        }),
        {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Set-Cookie': modifiedCookie,
          },
        }
      );
    }

    const user = userResult.rows[0];
    const { password_hash: storedHash } = user;
    const hasActiveTaRole = user.has_active_ta_role === true;

    // Verify password using Argon2id
    const isValid = await verifyPassword(password, storedHash);

    if (isValid) {
      const isInstructor = Boolean(user.instructor);
      const isTa = !isInstructor && hasActiveTaRole;
      const isStudent = !isInstructor && !isTa;

      const isPortalAllowed =
        (portal === 'student' && isStudent) ||
        (portal === 'admin' && (isInstructor || isTa));

      if (!isPortalAllowed) {
        const modifiedCookie = await getModifiedCookie({});
        const message =
          portal === 'student'
            ? 'This account must sign in using Admin Login'
            : 'This account must sign in using Student Login';

        return new Response(
          JSON.stringify({
            success: false,
            message,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': modifiedCookie,
            },
          }
        );
      }

      // Login successful - create authenticated cookie
      try {
        const userData = {
          username: user.username,
          student: isStudent,
          instructor: isInstructor,
          ta: isTa,
        };

        await invalidateAuthSessionFromCookie(
          cookieHeader,
          'rotated_on_login',
          client ?? undefined
        );

        // Create a new cookie with the user data
        const newCookie = await getModifiedCookie(userData);

        // Return success response with cookie and student info
        return new Response(
          JSON.stringify({
            username: user.username,
            success: true,
            student: userData.student,
            instructor: userData.instructor,
            ta: userData.ta,
          }),
          {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Set-Cookie': newCookie,
            },
          }
        );
      } catch (cookieError) {
        console.error('Error creating auth cookie:', cookieError);
        const modifiedCookie = await getModifiedCookie({});

        return new Response(
          JSON.stringify({
            success: false,
            message: 'Authentication session setup is unavailable. Please try again.',
          }),
          {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Set-Cookie': modifiedCookie,
            },
          }
        );
      }
    } else {
      // Invalid password. Use modify
      // cookie with an empty object to clear
      const modifiedCookie = await getModifiedCookie({});

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Incorrect password',
        }),
        {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Set-Cookie': modifiedCookie,
          },
        }
      );
    }
  } catch (error: unknown) {
    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const message =
      process.env.NODE_ENV === 'development'
        ? `Backend error: ${errorMessage}`
        : 'Unknown error in backend';

    // Make an empty cookie to clear any existing cookies
    const modifiedCookie = await getModifiedCookie({});

    return new Response(
      JSON.stringify({
        success: false,
        message,
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Set-Cookie': modifiedCookie,
        },
      }
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
