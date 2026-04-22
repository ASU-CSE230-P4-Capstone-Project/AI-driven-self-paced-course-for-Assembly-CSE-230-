import crypto from 'crypto';
import { DBConnection, type DBClient } from '@/app/sql/sql';
import type { VerifiedRequestAuth } from './request-auth';

export const AUTH_COOKIE_NAME = 'sens';
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
export const SESSION_RECENT_AUTH_WINDOW_MS = 15 * 60 * 1000;
export const SESSION_OPPORTUNISTIC_PRUNE_INTERVAL_MS = 12 * 60 * 60 * 1000;

export type SessionVerifyReason =
  | 'missing'
  | 'invalid'
  | 'expired'
  | 'reauth_required';

export type VerifySessionOptions = {
  requireRecentAuth?: boolean;
};

export type VerifySessionResult = {
  data: VerifiedRequestAuth | null;
  reason?: SessionVerifyReason;
};

type SessionRow = {
  username: string;
  student: boolean;
  instructor: boolean;
  ta: boolean;
  authenticated_at: string | Date;
  last_seen_at: string | Date;
  idle_expires_at: string | Date;
  absolute_expires_at: string | Date;
  invalidated_at: string | Date | null;
};

type GlobalWithSessionState = typeof globalThis & {
  __riscvAuthSessionsReady?: Promise<void>;
  __riscvAuthSessionsLastPrunedAtMs?: number;
  __riscvAuthSessionsPrunePromise?: Promise<void>;
};

function getGlobalSessionState(): GlobalWithSessionState {
  return globalThis as GlobalWithSessionState;
}

function shouldUseSecureCookies(): boolean {
  if (process.env.AUTH_COOKIE_SECURE === 'true') {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}

function buildCookieAttributes(expiresAt: Date): string {
  const secure = shouldUseSecureCookies() ? '; Secure' : '';
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  );

  return [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
    `Expires=${expiresAt.toUTCString()}`,
    'Priority=High',
  ].join('; ') + secure;
}

export function clearSessionCookie(): string {
  return `${AUTH_COOKIE_NAME}=; ${buildCookieAttributes(new Date(0))}`;
}

function createSessionCookie(token: string, absoluteExpiresAtMs: number): string {
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; ${buildCookieAttributes(
    new Date(absoluteExpiresAtMs)
  )}`;
}

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function parseTimestamp(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function toVerifiedAuth(row: SessionRow): VerifiedRequestAuth {
  return {
    username: row.username,
    student: row.student === true,
    instructor: row.instructor === true,
    ta: row.ta === true,
  };
}

function stripSessionCookie(cookieHeader: string): string {
  return cookieHeader
    .replace(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=[^;]*`), '')
    .replace(/^;\s*|\s*;$/g, '')
    .replace(/;\s*;/g, '; ');
}

function readSessionToken(cookieHeader: string): string | null {
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]*)`)
  );
  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function sessionIsExpired(
  entry: {
    idleExpiresAtMs: number;
    absoluteExpiresAtMs: number;
  },
  nowMs: number
): boolean {
  return (
    entry.idleExpiresAtMs <= nowMs ||
    entry.absoluteExpiresAtMs <= nowMs
  );
}

function sessionNeedsRecentAuth(
  authenticatedAtMs: number,
  nowMs: number,
  options?: VerifySessionOptions
): boolean {
  if (!options?.requireRecentAuth) {
    return false;
  }

  return nowMs - authenticatedAtMs > SESSION_RECENT_AUTH_WINDOW_MS;
}

async function ensureAuthSessionsTable(client: DBClient): Promise<void> {
  const globalState = getGlobalSessionState();

  if (!globalState.__riscvAuthSessionsReady) {
    globalState.__riscvAuthSessionsReady = client
      .query(`
        CREATE TABLE IF NOT EXISTS auth_sessions (
          session_id_hash text PRIMARY KEY,
          username text NOT NULL REFERENCES users(username) ON DELETE CASCADE,
          student boolean NOT NULL DEFAULT false,
          instructor boolean NOT NULL DEFAULT false,
          ta boolean NOT NULL DEFAULT false,
          authenticated_at timestamptz NOT NULL DEFAULT now(),
          last_seen_at timestamptz NOT NULL DEFAULT now(),
          idle_expires_at timestamptz NOT NULL,
          absolute_expires_at timestamptz NOT NULL,
          invalidated_at timestamptz,
          invalidation_reason text
        );

        CREATE INDEX IF NOT EXISTS idx_auth_sessions_username
          ON auth_sessions (username);

        CREATE INDEX IF NOT EXISTS idx_auth_sessions_idle_expires_at
          ON auth_sessions (idle_expires_at);

        CREATE INDEX IF NOT EXISTS idx_auth_sessions_absolute_expires_at
          ON auth_sessions (absolute_expires_at);
      `)
      .then(() => undefined)
      .catch((error) => {
        globalState.__riscvAuthSessionsReady = undefined;
        throw error;
      });
  }

  await globalState.__riscvAuthSessionsReady;
}

async function pruneExpiredAndInvalidatedSessions(
  client: DBClient
): Promise<number> {
  const result = await client.query(
    `DELETE FROM auth_sessions
     WHERE invalidated_at IS NOT NULL
        OR idle_expires_at <= now()
        OR absolute_expires_at <= now()`
  );

  return result.rowCount ?? 0;
}

async function maybePruneAuthSessions(client: DBClient): Promise<void> {
  const globalState = getGlobalSessionState();
  const nowMs = Date.now();
  const lastPrunedAtMs = globalState.__riscvAuthSessionsLastPrunedAtMs ?? 0;

  if (nowMs - lastPrunedAtMs < SESSION_OPPORTUNISTIC_PRUNE_INTERVAL_MS) {
    return;
  }

  if (!globalState.__riscvAuthSessionsPrunePromise) {
    globalState.__riscvAuthSessionsPrunePromise = pruneExpiredAndInvalidatedSessions(
      client
    )
      .then(() => undefined)
      .catch((error) => {
        console.warn('Auth session prune skipped:', error);
      })
      .finally(() => {
        globalState.__riscvAuthSessionsLastPrunedAtMs = Date.now();
        globalState.__riscvAuthSessionsPrunePromise = undefined;
      });
  }

  await globalState.__riscvAuthSessionsPrunePromise;
}

async function withDbClient<T>(
  client: DBClient | undefined,
  work: (resolvedClient: DBClient) => Promise<T>
): Promise<T> {
  if (client) {
    await ensureAuthSessionsTable(client);
    await maybePruneAuthSessions(client);
    return work(client);
  }

  const db = await DBConnection.create();
  try {
    await ensureAuthSessionsTable(db.client);
    await maybePruneAuthSessions(db.client);
    return await work(db.client);
  } finally {
    try {
      await db.client.end();
    } catch {}
  }
}

async function touchSessionInDatabase(
  client: DBClient,
  tokenHash: string,
  nowMs: number
): Promise<boolean> {
  const nextIdleExpiresAtMs = nowMs + SESSION_IDLE_TIMEOUT_MS;
  const result = await client.query(
    `UPDATE auth_sessions
     SET last_seen_at = $2,
         idle_expires_at = LEAST(absolute_expires_at, $3)
     WHERE session_id_hash = $1
       AND invalidated_at IS NULL
       AND idle_expires_at > $2
       AND absolute_expires_at > $2`,
    [tokenHash, new Date(nowMs), new Date(nextIdleExpiresAtMs)]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function createAuthSessionCookie(
  auth: VerifiedRequestAuth,
  client?: DBClient
): Promise<string> {
  const nowMs = Date.now();
  const absoluteExpiresAtMs = nowMs + SESSION_ABSOLUTE_TIMEOUT_MS;
  const idleExpiresAtMs = Math.min(
    nowMs + SESSION_IDLE_TIMEOUT_MS,
    absoluteExpiresAtMs
  );
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  await withDbClient(client, async (resolvedClient) => {
    await resolvedClient.query(
      `INSERT INTO auth_sessions (
         session_id_hash,
         username,
         student,
         instructor,
         ta,
         authenticated_at,
         last_seen_at,
         idle_expires_at,
         absolute_expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tokenHash,
        auth.username,
        auth.student,
        auth.instructor,
        auth.ta,
        new Date(nowMs),
        new Date(nowMs),
        new Date(idleExpiresAtMs),
        new Date(absoluteExpiresAtMs),
      ]
    );
  });

  return createSessionCookie(token, absoluteExpiresAtMs);
}

export async function invalidateAuthSessionFromCookie(
  cookieHeader: string,
  reason = 'logout',
  client?: DBClient
): Promise<void> {
  const token = readSessionToken(cookieHeader);
  if (!token) {
    return;
  }

  const tokenHash = hashSessionToken(token);

  await withDbClient(client, async (resolvedClient) => {
    await resolvedClient.query(
      `UPDATE auth_sessions
       SET invalidated_at = now(),
           invalidation_reason = $2
       WHERE session_id_hash = $1
         AND invalidated_at IS NULL`,
      [tokenHash, reason]
    );
  });
}

export async function invalidateUserSessions(
  username: string,
  reason = 'privilege_changed',
  client?: DBClient
): Promise<void> {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) {
    return;
  }

  await withDbClient(client, async (resolvedClient) => {
    await resolvedClient.query(
      `UPDATE auth_sessions
       SET invalidated_at = now(),
           invalidation_reason = $2
       WHERE username = $1
         AND invalidated_at IS NULL`,
      [trimmedUsername, reason]
    );
  });
}

export async function verifyAuthSession(
  cookieHeader: string,
  options?: VerifySessionOptions
): Promise<VerifySessionResult> {
  const token = readSessionToken(cookieHeader);
  if (!token) {
    return { data: null, reason: 'missing' };
  }

  const tokenHash = hashSessionToken(token);
  const nowMs = Date.now();

  return withDbClient(undefined, async (client) => {
    const result = await client.query<SessionRow>(
      `SELECT username,
              student,
              instructor,
              ta,
              authenticated_at,
              last_seen_at,
              idle_expires_at,
              absolute_expires_at,
              invalidated_at
       FROM auth_sessions
       WHERE session_id_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    const row = result.rows[0];
    if (!row || row.invalidated_at) {
      return { data: null, reason: 'invalid' } satisfies VerifySessionResult;
    }

    const authenticatedAtMs = parseTimestamp(row.authenticated_at);
    const absoluteExpiresAtMs = parseTimestamp(row.absolute_expires_at);
    const idleExpiresAtMs = parseTimestamp(row.idle_expires_at);

    if (sessionIsExpired({ idleExpiresAtMs, absoluteExpiresAtMs }, nowMs)) {
      return { data: null, reason: 'expired' } satisfies VerifySessionResult;
    }

    if (sessionNeedsRecentAuth(authenticatedAtMs, nowMs, options)) {
      return { data: null, reason: 'reauth_required' } satisfies VerifySessionResult;
    }

    const touched = await touchSessionInDatabase(client, tokenHash, nowMs);
    if (!touched) {
      return { data: null, reason: 'invalid' } satisfies VerifySessionResult;
    }

    return { data: toVerifiedAuth(row) } satisfies VerifySessionResult;
  });
}

export function buildVerifyCookieResponse(
  cookieHeader: string,
  data: Record<string, unknown> | null,
  reason?: SessionVerifyReason
) {
  return {
    cookie: data ? cookieHeader : stripSessionCookie(cookieHeader),
    data,
    reason,
  };
}
