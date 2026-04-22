const DEFAULT_BACKEND_URL = "http://localhost:25565";

export function getBackendUrl(path: string): string {
  const configuredBaseUrl = process.env.BACKEND_URL?.trim();
  const baseUrl = configuredBaseUrl || DEFAULT_BACKEND_URL;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}
