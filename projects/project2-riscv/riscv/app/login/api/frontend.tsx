'use client';

import { LoginPortal, LoginRequest, LoginResponse } from './types';
import {
  clearClientSessionData,
  setClientSessionData,
} from '@/components/client-session';

/**
 * Attempts to log in a user
 * @param username - The username
 * @param password - The password
 * @param portal - Login portal mode ('student' or 'admin')
 * @returns Promise with login result
 */
export async function login(
  username: string,
  password: string,
  portal: LoginPortal = 'student'
): Promise<LoginResponse> {
  try {
    const response = await fetch('/login/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, portal } satisfies LoginRequest)
    });

    const result = await response.json();
    if (result.success) {
      setClientSessionData({
        username: result.username,
        student: result.student === true,
        instructor: result.instructor === true,
        ta: result.ta === true,
      });
    } else {
      clearClientSessionData();
    }
    return result;
  } catch (error) {
    console.error('Login failed:', error);
    clearClientSessionData();
    return {
      success: false,
      username: ''
    };
  }
}
