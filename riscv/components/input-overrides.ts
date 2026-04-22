export type OverrideMap = Record<string, string>;

export type PersistedInputOverrides = {
  registerOverrides: OverrideMap;
  memoryOverrides: OverrideMap;
};

function normalizeOverrideMap(value: unknown): OverrideMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, entryValue]) =>
        typeof key === "string" && typeof entryValue === "string"
    )
  );
}

export function parsePersistedInputOverrides(
  raw: unknown
): PersistedInputOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { registerOverrides: {}, memoryOverrides: {} };
  }

  const record = raw as Record<string, unknown>;
  if ("registers" in record || "memory" in record) {
    return {
      registerOverrides: normalizeOverrideMap(record.registers),
      memoryOverrides: normalizeOverrideMap(record.memory),
    };
  }

  return {
    registerOverrides: normalizeOverrideMap(record),
    memoryOverrides: {},
  };
}

export function serializePersistedInputOverrides(
  registerOverrides: OverrideMap,
  memoryOverrides: OverrideMap
) {
  return {
    registers: registerOverrides,
    memory: memoryOverrides,
  };
}
