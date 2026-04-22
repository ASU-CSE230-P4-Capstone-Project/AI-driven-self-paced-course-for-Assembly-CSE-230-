import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCookieInternal } from '@/app/verify/internal';
import type { VerifyResponse } from '@/app/verify/types';
import { modifyCookieData } from './app/verify/modify';
import { setVerifiedRequestAuthHeaders } from '@/app/verify/request-auth';

// Define which routes should be protected by middleware
export const config = {
  runtime: 'nodejs', // Specify the Node.js runtime
  matcher: [
    '/student/:path*',
    '/instructor/:path*',
    '/ta/:path*'
  ],
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Run verification for all routes, figure out
  // if the user is actually verified
  // or not.

  const verifyResponse: VerifyResponse = await verifyCookieInternal(String(request.cookies));

  // If the JSON returned is null, the user is not logged in,
  // send them to the login page.
  if (verifyResponse.data === null) {
    // First off, clear their cookies
    const modifiedCookie = await modifyCookieData({});

    const response = NextResponse.redirect(new URL('/login', request.url));
    response.headers.set('Set-Cookie', modifiedCookie);
    return response;
  }

  const isStudentRoute = pathname.startsWith('/student');
  const isInstructorRoute = pathname.startsWith('/instructor');
  const isTaRoute = pathname.startsWith('/ta');
  const userData = verifyResponse.data as {
    student?: boolean;
    instructor?: boolean;
    ta?: boolean;
  };
  const isUserInstructor = userData?.instructor === true;
  const isUserTa = userData?.ta === true && !isUserInstructor;
  const isUserStudent = userData?.student === true && !isUserInstructor && !isUserTa;

  const homePath = isUserInstructor
    ? '/instructor'
    : isUserTa
      ? '/ta'
      : isUserStudent
        ? '/student'
        : null;

  if (!homePath) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const isOnWrongProtectedRoute =
    (isStudentRoute && homePath !== '/student') ||
    (isInstructorRoute && homePath !== '/instructor') ||
    (isTaRoute && homePath !== '/ta');

  if (isOnWrongProtectedRoute) {
    return NextResponse.redirect(new URL(homePath, request.url));
  }

  const requestHeaders = new Headers(request.headers);
  setVerifiedRequestAuthHeaders(
    requestHeaders,
    verifyResponse.data as Record<string, unknown>
  );

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
