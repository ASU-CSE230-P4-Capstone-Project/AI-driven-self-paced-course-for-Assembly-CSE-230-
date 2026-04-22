import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';
import { CreateLabRequestSchema } from './types';
import { modifyCookieData } from '@/app/verify/modify';
import { createUID } from '@/app/uid';

export async function POST(req: NextRequest) {
  // Verify the cookie to ensure user is authenticated
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader, {
    requireRecentAuth: true,
  });

  if (verifyResponse.reason === 'reauth_required') {
    return new Response(
      JSON.stringify({
        error: 'Reauthentication Required',
        message: 'Please sign in again before creating labs.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  
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

  // Check that user is an instructor (student must be false)
  if (verifyResponse.data.instructor !== true) {
    return new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Only instructors can create labs',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let db: DBConnection | null = null;
  
  try {
    // Parse the request body
    const body = await req.json();
    
    // Validate the request data
    const requestData = CreateLabRequestSchema.parse(body);
    
    // Generate UID and create lab object
    const uid = createUID();
    const labData = {
      uid: uid,
      title: requestData.name,
      md: ''
    };
    
    // Create database connection
    db = await DBConnection.create();
    const client = db.client;

    // Insert the new lab record
    const insertResult = await client.query(
      'INSERT INTO labs (uid, title, md) VALUES ($1, $2, $3) RETURNING uid, title, md',
      [labData.uid, labData.title, labData.md]
    );

    // Check if lab was created successfully
    if (insertResult.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database Error',
          message: 'Failed to create lab',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const createdLab = insertResult.rows[0];

    // Return successful response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lab created successfully',
        lab: {
          uid: createdLab.uid,
          title: createdLab.title,
          md: createdLab.md
        }
      }),
      {
        status: 201, // Created
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Create lab error:', error);
    const isZodError =
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: string }).name === 'ZodError';
    
    // Handle Zod validation errors
    if (isZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request data format',
          details:
            typeof error === 'object' &&
            error !== null &&
            'issues' in error
              ? (error as { issues?: unknown[] }).issues
              : undefined,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message:
          'An unexpected error occurred while creating lab: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
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
