import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';
import { ListLabsResponse } from './types';
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
    // Create database connection
    db = await DBConnection.create();
    const client = db.client;

    // Query all labs, ordered alphabetically by title
    const labsResult = await client.query(
      'SELECT uid, title, md FROM labs ORDER BY title ASC'
    );

    // Transform the results to match our response format
    const labs = labsResult.rows.map((row: any) => ({
      uid: row.uid,
      title: row.title,
      md: row.md
    }));

    // Return successful response with labs data
    const response: ListLabsResponse = {
      success: true,
      labs: labs
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('List labs error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while fetching labs: ' + (error.message || 'Unknown error'),
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
