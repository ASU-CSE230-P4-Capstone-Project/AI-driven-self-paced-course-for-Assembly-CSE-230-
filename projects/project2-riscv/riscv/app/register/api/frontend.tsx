"use client";

import {
  RegisterRequestSchema,
  RegisterResponseSchema,
  type RegisterResponse,
} from "./types";
import { normalizeAsuidInput } from "@/app/lib/asuid";

export async function registerUser(
  username: string,
  asuid: string,
  password: string,
  confirmPassword: string
): Promise<RegisterResponse> {
  try {
    const validatedRequest = RegisterRequestSchema.parse({
      username: username.trim(),
      asuid: normalizeAsuidInput(asuid),
      password,
      confirmPassword,
    });

    const response = await fetch("/register/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validatedRequest),
    });

    const responseData = await response.json();
    return RegisterResponseSchema.parse(responseData);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}
