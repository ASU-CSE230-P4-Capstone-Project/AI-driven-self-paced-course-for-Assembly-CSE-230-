'use client';

import type { UserSettings, UserSettingsResponse } from './types';

export async function getUserSettings(): Promise<UserSettingsResponse> {
  try {
    const response = await fetch('/api/user_settings', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const data: UserSettingsResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Get user settings frontend error:', error);
    return {
      success: false,
      message: 'Failed to connect to the server',
    };
  }
}

export async function saveUserSettings(
  settings: UserSettings
): Promise<UserSettingsResponse> {
  try {
    const response = await fetch('/api/user_settings', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    const data: UserSettingsResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Save user settings frontend error:', error);
    return {
      success: false,
      message: 'Failed to connect to the server',
    };
  }
}
