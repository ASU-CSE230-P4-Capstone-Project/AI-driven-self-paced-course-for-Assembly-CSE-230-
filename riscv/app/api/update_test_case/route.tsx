import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';
import { UpdateTestCaseRequestSchema } from './types';
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
        message: 'Please sign in again before updating test cases.',
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
        message: 'Only instructors can update test cases',
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
    const requestData = UpdateTestCaseRequestSchema.parse(body);
    
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

    // Build dynamic update query based on provided fields
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (requestData.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(requestData.name);
      paramIndex++;
    }
    if (requestData.seed_registers !== undefined) {
      updates.push(`seed_registers = $${paramIndex}`);
      values.push(requestData.seed_registers);
      paramIndex++;
    }
    if (requestData.seed_memory !== undefined) {
      updates.push(`seed_memory = $${paramIndex}`);
      values.push(requestData.seed_memory);
      paramIndex++;
    }
    if (requestData.result_registers !== undefined) {
      updates.push(`result_registers = $${paramIndex}`);
      values.push(requestData.result_registers);
      paramIndex++;
    }
    if (requestData.result_memory !== undefined) {
      updates.push(`result_memory = $${paramIndex}`);
      values.push(requestData.result_memory);
      paramIndex++;
    }

    // If no fields to update, return current state
    if (updates.length === 0) {
      const currentResult = await client.query(
        `SELECT uid, lab_uid, name, seed_registers, seed_memory, result_registers, result_memory 
         FROM test_cases WHERE uid = $1`,
        [requestData.uid]
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No changes made',
          testCase: currentResult.rows[0]
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Add uid as the last parameter
    values.push(requestData.uid);

    // Execute update query
    const updateResult = await client.query(
      `UPDATE test_cases 
       SET ${updates.join(', ')} 
       WHERE uid = $${paramIndex} 
       RETURNING uid, lab_uid, name, seed_registers, seed_memory, result_registers, result_memory`,
      values
    );

    if (updateResult.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database Error',
          message: 'Failed to update test case',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const updatedTestCase = updateResult.rows[0];

    // Return successful response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test case updated successfully',
        testCase: {
          uid: updatedTestCase.uid,
          lab_uid: updatedTestCase.lab_uid,
          name: updatedTestCase.name,
          seed_registers: updatedTestCase.seed_registers,
          seed_memory: updatedTestCase.seed_memory,
          result_registers: updatedTestCase.result_registers,
          result_memory: updatedTestCase.result_memory
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Update test case error:', error);
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
          'An unexpected error occurred while updating test case: ' +
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
