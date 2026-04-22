import {
  CreateUserRequest,
  CreateUserResponse,
  CreateUserRequestSchema,
  CreateUserResponseSchema,
  type CreateUserRole,
} from './types';
import { normalizeAsuidInput } from '@/app/lib/asuid';

export async function createUser(
  username: string,
  asuid: string,
  password: string,
  role: CreateUserRole
): Promise<CreateUserResponse> {
  try {
    // Build the request object
    const requestBody: CreateUserRequest = {
      username: username.trim(),
      asuid: normalizeAsuidInput(asuid),
      password,
      role,
    };

    // Validate request
    const validatedRequest = CreateUserRequestSchema.parse(requestBody);

    // Send the fetch request
    const response = await fetch('/instructor/create_user/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedRequest),
    });

    // Parse the response
    const responseData = await response.json();
    
    // Validate response
    const validatedResponse = CreateUserResponseSchema.parse(responseData);
    
    return validatedResponse;
  } catch (error) {
    // Return error response
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
}
