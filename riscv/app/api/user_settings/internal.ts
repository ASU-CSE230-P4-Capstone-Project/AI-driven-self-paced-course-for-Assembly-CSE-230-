import "server-only";

import { DBConnection } from "@/app/sql/sql";
import { verifyCookieInternal } from "@/app/verify/internal";
import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from "./types";

export type UserSettingsLoadResult = {
  authenticated: boolean;
  success: boolean;
  settings: UserSettings;
  username?: string;
  message?: string;
};

export function mapRowToSettings(
  row: Record<string, unknown> | undefined
): UserSettings {
  if (!row) {
    return DEFAULT_USER_SETTINGS;
  }

  return {
    editorFontSize:
      typeof row.editor_font_size === "number"
        ? row.editor_font_size
        : DEFAULT_USER_SETTINGS.editorFontSize,
    showHelpBubble:
      typeof row.show_help_bubble === "boolean"
        ? row.show_help_bubble
        : DEFAULT_USER_SETTINGS.showHelpBubble,
    openInstructionsByDefault:
      typeof row.open_instructions_by_default === "boolean"
        ? row.open_instructions_by_default
        : DEFAULT_USER_SETTINGS.openInstructionsByDefault,
    warnBeforeReinstate:
      typeof row.warn_before_reinstate === "boolean"
        ? row.warn_before_reinstate
        : DEFAULT_USER_SETTINGS.warnBeforeReinstate,
  };
}

export async function getUserSettingsForUsername(
  username: string
): Promise<UserSettings> {
  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();
    const result = await db.client.query(
      `SELECT editor_font_size,
              show_help_bubble,
              open_instructions_by_default,
              warn_before_reinstate
       FROM user_settings
       WHERE username = $1`,
      [username]
    );

    return mapRowToSettings(result.rows[0]);
  } finally {
    if (db) {
      try {
        await db.client.end();
      } catch {}
    }
  }
}

export async function loadUserSettingsForUsername(
  username: string
): Promise<UserSettingsLoadResult> {
  try {
    const settings = await getUserSettingsForUsername(username);
    return {
      authenticated: true,
      success: true,
      settings,
      username,
    };
  } catch (error: unknown) {
    console.error("loadUserSettingsForUsername:", error);
    return {
      authenticated: true,
      success: false,
      settings: DEFAULT_USER_SETTINGS,
      username,
      message:
        error instanceof Error ? error.message : "Failed to load user settings",
    };
  }
}

export async function loadUserSettingsForCookie(
  cookieHeader: string
): Promise<UserSettingsLoadResult> {
  const verifyResponse = await verifyCookieInternal(cookieHeader);

  if (!verifyResponse.data || !verifyResponse.data.username) {
    return {
      authenticated: false,
      success: false,
      settings: DEFAULT_USER_SETTINGS,
      message: "Invalid or missing authentication",
    };
  }

  const username = String(verifyResponse.data.username);
  return loadUserSettingsForUsername(username);
}
