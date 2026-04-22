'use client';

import {
  UserSearchRequest,
  UserSearchResponse,
  UserSearchRequestSchema,
  UserSearchResponseSchema,
} from "./types";

export async function searchUsers(request: UserSearchRequest): Promise<UserSearchResponse> {
  try {
    const validatedRequest = UserSearchRequestSchema.parse(request);
    const response = await fetch("/instructor/user_search/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validatedRequest),
    });

    const data = await response.json();
    return UserSearchResponseSchema.parse(data);
  } catch (error) {
    console.error("User search frontend error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
