export const ASUID_REGEX = /^[0-9]{10}$/;

export const ASUID_REQUIRED_MESSAGE = "ASU ID is required";
export const ASUID_INVALID_MESSAGE = "ASU ID must be exactly 10 digits";

export function normalizeAsuidInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function isValidAsuid(value: string | null | undefined): value is string {
  return typeof value === "string" && ASUID_REGEX.test(value.trim());
}

export function getMissingAsuidMessage(
  username: string,
  action = "be added"
): string {
  return `User '${username}' must have a valid 10-digit ASUID before they can ${action}.`;
}
