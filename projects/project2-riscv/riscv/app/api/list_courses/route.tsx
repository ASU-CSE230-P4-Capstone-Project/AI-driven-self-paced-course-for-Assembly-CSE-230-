import { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import { DBConnection } from '@/app/sql/sql';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  // Check authentication
  if (
    !verifyResponse.data ||
    !verifyResponse.data.username ||
    typeof verifyResponse.data.student === 'undefined'
  ) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or missing authentication',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const client = db.client;

    const result = await client.query(
      'SELECT course_id, code, title, term FROM courses ORDER BY created_at DESC'
    );

    return new Response(
      JSON.stringify({
        success: true,
        courses: result.rows,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('List courses error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message:
          'An unexpected error occurred while listing courses: ' +
          (error.message || 'Unknown error'),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    if (db) {
      try {
        await db.client.end();
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }
  }
}
