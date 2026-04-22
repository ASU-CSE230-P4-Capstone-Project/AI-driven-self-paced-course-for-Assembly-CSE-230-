export function formatUserDisplayName(username: string): string {
  const cleaned = username.trim();

  if (!cleaned) {
    return "Unknown User";
  }

  return cleaned
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
