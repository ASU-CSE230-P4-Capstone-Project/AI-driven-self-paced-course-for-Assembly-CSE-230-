// Generates a UID consistent with our convention;
// current UTC as YYYYMMDDHHMMSSmmmm (4-digit milliseconds), concatenated
// with a uuidv4. Note though, for the purpose
// of UIDs, any UTC string will do

function generatePythonUID(uuid: string): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  const ms = String(now.getUTCMilliseconds()).padStart(4, '0');
  const timeString = `${y}${m}${d}${h}${min}${s}${ms}`;
  return timeString + uuid;
}

function createUID_server() {
  const uuid = crypto.randomUUID(); // Generate a UUID v4
  return generatePythonUID(uuid);
}

function createUID_client() {
  // Check if window.crypto is available
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    const uuid = window.crypto.randomUUID(); // Generate a UUID v4
    return generatePythonUID(uuid);
  } else {
    // Fallback for environments where crypto is not available
    // Simple UUID v4 generation using Math.random
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    return generatePythonUID(uuid);
  }
}

export function createUID() {
  if (typeof window === "undefined") {
    // Server-side
    return createUID_server();
  } else {
    // Client-side
    return createUID_client();
  }
}