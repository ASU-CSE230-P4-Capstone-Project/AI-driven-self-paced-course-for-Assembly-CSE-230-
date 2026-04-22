// Defines some helpers for the backend to work with
// passwords, including our argon2id parameters.

import * as argon2 from "argon2";
import * as crypto from "crypto";

// Ensure this file can only be used in server-side code by importing Node.js specific modules
// This will cause build errors if imported in frontend code
if (typeof window !== 'undefined') {
  throw new Error('Password utilities can only be used on the server side');
}

// Argon2id configuration parameters
const ARGON2_CONFIG = {
  // Memory cost in KiB (65536 = 64MB)
  memoryCost: 65536,
  
  // Time cost (number of iterations)
  timeCost: 3,
  
  // Parallelism (number of threads)
  parallelism: 4,
  
  // Hash length in bytes
  hashLength: 32,
  
  // Use Argon2id (resistant to both side-channel and GPU attacks)
  type: argon2.argon2id,
  
  // Encoding format
  encode: 'hex'
} as const;

/**
 * Hash a password using Argon2id with secure parameters
 * @param password - The plain text password to hash
 * @returns Promise<string> - The Argon2id hash including salt and parameters
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await argon2.hash(password, ARGON2_CONFIG);
    return hash;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify a password against an Argon2id hash
 * @param password - The plain text password to verify
 * @param hash - The Argon2id hash to compare against
 * @returns Promise<boolean> - True if password matches hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const isValid = await argon2.verify(hash, password);
    return isValid;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

/**
 * Generate a cryptographically secure random salt
 * Note: Argon2 handles salt generation internally, but this is kept for compatibility
 * with existing database schema that expects a salt column
 * @returns string - A 2000-character hex string (compatible with existing implementation)
 */
export function generateSalt(): string {
  return crypto.randomBytes(1000).toString('hex').substring(0, 2000);
}

// Export the config for potential debugging or logging purposes
export { ARGON2_CONFIG };
