import type { VerifyResponse } from './types';
import {
  buildVerifyCookieResponse,
  type VerifySessionOptions,
  verifyAuthSession,
} from './session';

/**
 * Internal verification function that validates the opaque auth session cookie.
 *
 * @param cookie - The full cookie string to verify
 * @returns VerifyResponse with verified data or null on failure
 */
export async function verifyCookieInternal(
  cookie: string,
  options?: VerifySessionOptions
): Promise<VerifyResponse> {
  try {
    const result = await verifyAuthSession(cookie, options);
    return buildVerifyCookieResponse(cookie, result.data, result.reason);
  } catch (verificationError) {
    console.error('Verification error:', verificationError);
    return buildVerifyCookieResponse(cookie, null, 'invalid');
  }
}
