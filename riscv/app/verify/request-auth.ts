export type VerifiedRequestAuth = {
  username: string;
  student: boolean;
  instructor: boolean;
  ta: boolean;
};

type HeaderReader = {
  get(name: string): string | null;
};

const VERIFIED_HEADER_PREFIX = "x-riscv-auth-";

export const VERIFIED_AUTH_HEADERS = {
  username: `${VERIFIED_HEADER_PREFIX}username`,
  student: `${VERIFIED_HEADER_PREFIX}student`,
  instructor: `${VERIFIED_HEADER_PREFIX}instructor`,
  ta: `${VERIFIED_HEADER_PREFIX}ta`,
} as const;

function parseHeaderBoolean(value: string | null): boolean {
  return value === "true";
}

export function setVerifiedRequestAuthHeaders(
  headers: Headers,
  data: Record<string, unknown>
): Headers {
  const username =
    typeof data.username === "string" ? data.username.trim() : "";

  headers.set(VERIFIED_AUTH_HEADERS.username, username);
  headers.set(
    VERIFIED_AUTH_HEADERS.student,
    String(data.student === true)
  );
  headers.set(
    VERIFIED_AUTH_HEADERS.instructor,
    String(data.instructor === true)
  );
  headers.set(VERIFIED_AUTH_HEADERS.ta, String(data.ta === true));

  return headers;
}

export function readVerifiedRequestAuth(
  headers: HeaderReader
): VerifiedRequestAuth | null {
  const username = headers.get(VERIFIED_AUTH_HEADERS.username)?.trim() ?? "";

  if (!username) {
    return null;
  }

  return {
    username,
    student: parseHeaderBoolean(headers.get(VERIFIED_AUTH_HEADERS.student)),
    instructor: parseHeaderBoolean(headers.get(VERIFIED_AUTH_HEADERS.instructor)),
    ta: parseHeaderBoolean(headers.get(VERIFIED_AUTH_HEADERS.ta)),
  };
}
