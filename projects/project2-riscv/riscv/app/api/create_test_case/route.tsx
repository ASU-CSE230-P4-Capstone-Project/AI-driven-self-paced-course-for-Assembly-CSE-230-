import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';
import { CreateTestCaseRequestSchema } from './types';
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
        message: 'Please sign in again before creating test cases.',
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
        message: 'Only instructors can create test cases',
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
    const requestData = CreateTestCaseRequestSchema.parse(body);
    
    // Generate UID and create test case object
    const uid = createUID();
    const testCaseData = {
      uid: uid,
      lab_uid: requestData.lab_uid,
      name: requestData.name,
      seed_registers: '{}',
      seed_memory: '{}',
      result_registers: '{}',
      result_memory: '{}'
    };
    
    // Create database connection
    db = await DBConnection.create();
    const client = db.client;

    // Verify the lab exists
    const labCheck = await client.query(
      'SELECT uid FROM labs WHERE uid = $1',
      [requestData.lab_uid]
    );

    if (labCheck.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Not Found',
          message: 'Lab not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert the new test case record
    const insertResult = await client.query(
      `INSERT INTO test_cases (uid, lab_uid, name, seed_registers, seed_memory, result_registers, result_memory) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING uid, lab_uid, name, seed_registers, seed_memory, result_registers, result_memory`,
      [testCaseData.uid, testCaseData.lab_uid, testCaseData.name, 
       testCaseData.seed_registers, testCaseData.seed_memory, 
       testCaseData.result_registers, testCaseData.result_memory]
    );

    // Check if test case was created successfully
    if (insertResult.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database Error',
          message: 'Failed to create test case',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const createdTestCase = insertResult.rows[0];

    // Return successful response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test case created successfully',
        testCase: {
          uid: createdTestCase.uid,
          lab_uid: createdTestCase.lab_uid,
          name: createdTestCase.name,
          seed_registers: createdTestCase.seed_registers,
          seed_memory: createdTestCase.seed_memory,
          result_registers: createdTestCase.result_registers,
          result_memory: createdTestCase.result_memory
        }
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Create test case error:', error);
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
          'An unexpected error occurred while creating test case: ' +
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
