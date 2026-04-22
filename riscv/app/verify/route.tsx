import { NextRequest } from 'next/server';
import { VerifyRequestSchema } from './types';
import { verifyCookieInternal } from './internal';

// POST-only endpoint for verification
export async function POST(req: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await req.json();
    const parsedBody = VerifyRequestSchema.safeParse(body);
    
    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation Error',
          message: 'Invalid request format',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { cookie } = parsedBody.data;

    // Use internal verification function
    const verifyResponse = await verifyCookieInternal(cookie);

    return new Response(
      JSON.stringify(verifyResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Verification API error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during verification: ' + (error.message || 'Unknown error'),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
