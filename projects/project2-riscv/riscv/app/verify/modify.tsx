import type { DBClient } from '@/app/sql/sql';
import { clearSessionCookie, createAuthSessionCookie } from './session';

/**
 * Internal utility function to clear or replace the opaque auth session cookie.
 * Passing an empty object clears the session cookie. Passing verified auth data
 * creates a new server-side session and returns the Set-Cookie header value.
 */
export async function modifyCookieData(
  newData: Record<string, unknown>,
  client?: DBClient
): Promise<string> {
  const username =
    typeof newData.username === 'string' ? newData.username.trim() : '';

  if (!username) {
    return clearSessionCookie();
  }

  return createAuthSessionCookie(
    {
      username,
      student: newData.student === true,
      instructor: newData.instructor === true,
      ta: newData.ta === true,
    },
    client
  );
}
