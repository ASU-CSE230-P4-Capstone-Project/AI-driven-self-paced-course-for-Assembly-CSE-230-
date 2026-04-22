"use client";

import {
  ManageRoleRequest,
  ManageRoleResponse,
  ManageRoleRequestSchema,
  ManageRoleResponseSchema,
} from "./types";

export async function updateCourseRole(request: ManageRoleRequest): Promise<ManageRoleResponse> {
  try {
    const validatedRequest = ManageRoleRequestSchema.parse(request);
    const response = await fetch("/instructor/manage_roles/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validatedRequest),
    });

    const data = await response.json();
    return ManageRoleResponseSchema.parse(data);
  } catch (error) {
    console.error("Manage roles frontend error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
