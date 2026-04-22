"use client";

const CLIENT_SESSION_STORAGE_KEY = "riscv-client-session";

export type ClientSessionData = {
  username?: string;
  student?: boolean;
  instructor?: boolean;
  ta?: boolean;
};

export function getClientSessionData(): ClientSessionData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(CLIENT_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ClientSessionData;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function setClientSessionData(data: ClientSessionData) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    CLIENT_SESSION_STORAGE_KEY,
    JSON.stringify({
      username:
        typeof data.username === "string" ? data.username.trim() : "",
      student: data.student === true,
      instructor: data.instructor === true,
      ta: data.ta === true,
    } satisfies ClientSessionData)
  );
}

export function clearClientSessionData() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(CLIENT_SESSION_STORAGE_KEY);
}

export function getClientUsername(): string | null {
  const session = getClientSessionData();
  return typeof session?.username === "string" && session.username.trim()
    ? session.username
    : null;
}
