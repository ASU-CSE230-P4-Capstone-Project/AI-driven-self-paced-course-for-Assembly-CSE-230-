import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';
import { DeleteTestCaseRequestSchema } from './types';
import { modifyCookieData } from '@/app/verify/modify';

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
        message: 'Please sign in again before deleting test cases.',
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
        message: 'Only instructors can delete test cases',
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
    const requestData = DeleteTestCaseRequestSchema.parse(body);
    
    // Create database connection
    db = await DBConnection.create();
    const client = db.client;

    // Check if test case exists
    const existingResult = await client.query(
      'SELECT uid FROM test_cases WHERE uid = $1',
      [requestData.uid]
    );

    if (existingResult.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Not Found',
          message: 'Test case not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Delete the test case
    await client.query(
      'DELETE FROM test_cases WHERE uid = $1',
      [requestData.uid]
    );

    // Return successful response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test case deleted successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Delete test case error:', error);
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
          'An unexpected error occurred while deleting test case: ' +
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
