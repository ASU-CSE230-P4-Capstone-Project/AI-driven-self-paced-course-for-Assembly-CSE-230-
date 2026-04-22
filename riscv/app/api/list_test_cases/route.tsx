import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';
import { ListTestCasesRequestSchema, ListTestCasesResponse } from './types';
import { modifyCookieData } from '@/app/verify/modify';

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

  let db: DBConnection | null = null;
  
  try {
    // Parse the request body
    const body = await req.json();
    
    // Validate the request data
    const requestData = ListTestCasesRequestSchema.parse(body);
    
    // Create database connection
    db = await DBConnection.create();
    const client = db.client;

    // Query all test cases for the given lab, ordered by name
    const testCasesResult = await client.query(
      `SELECT uid, lab_uid, name, seed_registers, seed_memory, result_registers, result_memory 
       FROM test_cases 
       WHERE lab_uid = $1 
       ORDER BY name ASC`,
      [requestData.lab_uid]
    );

    // Transform the results to match our response format
    const testCases = testCasesResult.rows.map((row: any) => ({
      uid: row.uid,
      lab_uid: row.lab_uid,
      name: row.name,
      seed_registers: row.seed_registers,
      seed_memory: row.seed_memory,
      result_registers: row.result_registers,
      result_memory: row.result_memory
    }));

    // Return successful response with test cases data
    const response: ListTestCasesResponse = {
      success: true,
      testCases: testCases
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('List test cases error:', error);
    
    // Handle Zod validation errors
    if (error.name === 'ZodError') {
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
        message: 'An unexpected error occurred while fetching test cases: ' + (error.message || 'Unknown error'),
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
