"use client";

import React from "react";

type OverrideKind = "register" | "memory";

type OverrideListEditorProps = {
  kind: OverrideKind;
  title: string;
  overrides: Record<string, string>;
  onChange: (nextOverrides: Record<string, string>) => void;
  disabled?: boolean;
};

type OverrideRow = {
  id: string;
  key: string;
  value: string;
};

type Notice = {
  message: string;
  tone: "neutral" | "warning";
};

const MAX_MEMORY_ADDRESS = 1024;
const MAX_MEMORY_VALUE = 0xffffffff;

function makeRowId() {
  return `override-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function normalizeRegisterKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizeMemoryKey(value: string) {
  return value.trim().toLowerCase();
}

function isValidRegisterKey(value: string) {
  const normalized = normalizeRegisterKey(value);
  const match = normalized.match(/^x(\d+)$/);
  if (!match) return false;
  const registerNumber = parseInt(match[1], 10);
  return registerNumber >= 0 && registerNumber <= 31;
}

function isValidMemoryKey(value: string) {
  const normalized = normalizeMemoryKey(value);
  if (!/^0x[0-9a-f]+$/.test(normalized)) return false;
  const parsed = parseInt(normalized, 16);
  return parsed >= 0 && parsed < MAX_MEMORY_ADDRESS;
}

function isValidOverrideValue(value: string) {
  const normalized = normalizeValue(value);
  if (!/^0x[0-9a-f]+$/.test(normalized)) return false;
  const parsed = parseInt(normalized, 16);
  return parsed >= 0 && parsed <= MAX_MEMORY_VALUE;
}

function compareRegisterKeys(a: string, b: string) {
  const registerA = parseInt(normalizeRegisterKey(a).replace(/\D/g, ""), 10);
  const registerB = parseInt(normalizeRegisterKey(b).replace(/\D/g, ""), 10);

  if (!Number.isNaN(registerA) && !Number.isNaN(registerB)) {
    return registerA - registerB;
  }

  return a.localeCompare(b, undefined, { numeric: true });
}

function compareMemoryKeys(a: string, b: string) {
  const addressA = parseInt(normalizeMemoryKey(a), 16);
  const addressB = parseInt(normalizeMemoryKey(b), 16);

  if (!Number.isNaN(addressA) && !Number.isNaN(addressB)) {
    return addressA - addressB;
  }

  return a.localeCompare(b, undefined, { numeric: true });
}

function getConfig(kind: OverrideKind) {
  if (kind === "register") {
    return {
      keyLabel: "Register",
      keyPlaceholder: "x0",
      normalizeKey: normalizeRegisterKey,
      validateKey: isValidRegisterKey,
      compareKeys: compareRegisterKeys,
      keyHelperMessage: "Valid registers are x0 through x31.",
      valueHelperMessage: "Values must be hex from 0x0 through 0xffffffff.",
    };
  }

  return {
    keyLabel: "Address",
    keyPlaceholder: "0x0",
    normalizeKey: normalizeMemoryKey,
    validateKey: isValidMemoryKey,
    compareKeys: compareMemoryKeys,
    keyHelperMessage: "Valid addresses are hex values from 0x0 through 0x3ff.",
    valueHelperMessage: "Values must be hex from 0x0 through 0xffffffff.",
  };
}

function rowsFromOverrides(
  overrides: Record<string, string>,
  kind: OverrideKind
): OverrideRow[] {
  const config = getConfig(kind);

  return Object.entries(overrides)
    .sort(([keyA], [keyB]) => config.compareKeys(keyA, keyB))
    .map(([key, value]) => ({
      id: makeRowId(),
      key,
      value,
    }));
}

function rowsToOverrides(rows: OverrideRow[], kind: OverrideKind) {
  const config = getConfig(kind);

  return Object.fromEntries(
    rows.map((row) => [
      config.normalizeKey(row.key),
      normalizeValue(row.value),
    ])
  );
}

function rowsArePersistable(rows: OverrideRow[], kind: OverrideKind) {
  const config = getConfig(kind);
  const seen = new Set<string>();

  for (const row of rows) {
    if (!config.validateKey(row.key) || !isValidOverrideValue(row.value)) {
      return false;
    }

    const normalizedKey = config.normalizeKey(row.key);
    if (seen.has(normalizedKey)) {
      return false;
    }
    seen.add(normalizedKey);
  }

  return true;
}

function rowsMatchOverrides(
  rows: OverrideRow[],
  overrides: Record<string, string>,
  kind: OverrideKind
) {
  const config = getConfig(kind);

  if (!rowsArePersistable(rows, kind)) return false;

  const normalizedOverrides = Object.fromEntries(
    Object.entries(overrides).map(([key, value]) => [
      config.normalizeKey(key),
      normalizeValue(value),
    ])
  );
  const normalizedRows = rowsToOverrides(rows, kind);
  const overrideKeys = Object.keys(normalizedOverrides).sort(config.compareKeys);
  const rowKeys = Object.keys(normalizedRows).sort(config.compareKeys);

  if (overrideKeys.length !== rowKeys.length) return false;

  return overrideKeys.every(
    (key, index) =>
      key === rowKeys[index] && normalizedOverrides[key] === normalizedRows[key]
  );
}

export default function OverrideListEditor({
  kind,
  title,
  overrides,
  onChange,
  disabled = false,
}: OverrideListEditorProps) {
  const config = React.useMemo(() => getConfig(kind), [kind]);
  const [rows, setRows] = React.useState<OverrideRow[]>(() =>
    rowsFromOverrides(overrides, kind)
  );
  const [draftKey, setDraftKey] = React.useState("");
  const [draftValue, setDraftValue] = React.useState("");
  const [notice, setNotice] = React.useState<Notice | null>(null);

  React.useEffect(() => {
    setRows((currentRows) =>
      rowsMatchOverrides(currentRows, overrides, kind)
        ? currentRows
        : rowsFromOverrides(overrides, kind)
    );
  }, [kind, overrides]);

  React.useEffect(() => {
    if (!notice) return;

    const timeout = window.setTimeout(() => {
      setNotice(null);
    }, 2800);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  const keyHasDuplicate = React.useCallback(
    (rowId: string, key: string) => {
      const normalizedKey = config.normalizeKey(key);
      if (!normalizedKey) return false;

      return rows.some(
        (row) => row.id !== rowId && config.normalizeKey(row.key) === normalizedKey
      );
    },
    [config, rows]
  );

  const showNotice = React.useCallback((message: string, tone: Notice["tone"] = "warning") => {
    setNotice({ message, tone });
  }, []);

  const persistRows = React.useCallback(
    (nextRows: OverrideRow[]) => {
      if (!rowsArePersistable(nextRows, kind)) return;
      onChange(rowsToOverrides(nextRows, kind));
    },
    [kind, onChange]
  );

  const updateRow = React.useCallback(
    (rowId: string, field: "key" | "value", nextValue: string) => {
      setRows((currentRows) => {
        const nextRows = currentRows.map((row) =>
          row.id === rowId ? { ...row, [field]: nextValue } : row
        );
        persistRows(nextRows);
        return nextRows;
      });
    },
    [persistRows]
  );

  const removeRow = React.useCallback(
    (rowId: string) => {
      if (
        !window.confirm(
          `Remove this ${config.keyLabel.toLowerCase()} override?`
        )
      ) {
        return;
      }

      setRows((currentRows) => {
        const nextRows = currentRows.filter((row) => row.id !== rowId);
        onChange(rowsToOverrides(nextRows, kind));
        return nextRows;
      });
    },
    [config.keyLabel, kind, onChange]
  );

  const duplicateDraftKey = rows.some(
    (row) => config.normalizeKey(row.key) === config.normalizeKey(draftKey)
  );
  const addDisabled =
    disabled ||
    !config.validateKey(draftKey) ||
    !isValidOverrideValue(draftValue) ||
    duplicateDraftKey;
  const hasInvalidRows = rows.some(
    (row) =>
      !config.validateKey(row.key) ||
      !isValidOverrideValue(row.value) ||
      keyHasDuplicate(row.id, row.key)
  );

  const helperMessage =
    draftKey.length > 0 && !config.validateKey(draftKey)
      ? config.keyHelperMessage
      : draftValue.length > 0 && !isValidOverrideValue(draftValue)
        ? config.valueHelperMessage
      : duplicateDraftKey
        ? `That ${config.keyLabel.toLowerCase()} already has an override.`
        : hasInvalidRows
          ? `Fix invalid or duplicate ${config.keyLabel.toLowerCase()} entries to save changes.`
          : `${config.keyHelperMessage} ${config.valueHelperMessage}`;

  const handleAdd = React.useCallback(() => {
    if (addDisabled) return;

    const nextRows = [
      ...rows,
      {
        id: makeRowId(),
        key: config.normalizeKey(draftKey),
        value: normalizeValue(draftValue),
      },
    ].sort((rowA, rowB) => config.compareKeys(rowA.key, rowB.key));

    setRows(nextRows);
    onChange(rowsToOverrides(nextRows, kind));
    setDraftKey("");
    setDraftValue("");
  }, [addDisabled, config, draftKey, draftValue, kind, onChange, rows]);

  return (
    <div
      className={`relative rounded border bg-white p-4 text-black ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      {notice && (
        <div
          aria-live="polite"
          className={`pointer-events-none absolute right-4 top-4 z-10 max-w-xs rounded-lg border px-3 py-2 text-xs shadow-lg ${
            notice.tone === "warning"
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-gray-200 bg-white text-gray-700"
          }`}
        >
          {notice.message}
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold">{title}</h2>

      <div className="space-y-2">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>{config.keyLabel}</span>
          <span>Value</span>
          <span className="sr-only">Actions</span>
        </div>

        {rows.length > 0 ? (
          rows.map((row) => {
            const keyValid = config.validateKey(row.key);
            const valueValid = isValidOverrideValue(row.value);
            const duplicate = keyHasDuplicate(row.id, row.key);

            return (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2"
              >
                <input
                  type="text"
                  value={row.key}
                  disabled={disabled}
                  onChange={(event) =>
                    updateRow(row.id, "key", event.target.value)
                  }
                  onBlur={() => {
                    if (!row.key.trim()) return;
                    if (!keyValid) {
                      showNotice(config.keyHelperMessage);
                      return;
                    }
                    if (duplicate) {
                      showNotice(
                        `That ${config.keyLabel.toLowerCase()} already has an override.`
                      );
                    }
                  }}
                  placeholder={config.keyPlaceholder}
                  className={`rounded border px-2 py-1 font-mono text-sm disabled:bg-zinc-200 ${
                    keyValid && !duplicate
                      ? "border-gray-300"
                      : "border-red-500 bg-red-50 text-red-700"
                  }`}
                />
                <input
                  type="text"
                  value={row.value}
                  disabled={disabled}
                  onChange={(event) =>
                    updateRow(row.id, "value", event.target.value)
                  }
                  onBlur={() => {
                    if (row.value.trim() && !valueValid) {
                      showNotice(config.valueHelperMessage);
                    }
                  }}
                  placeholder="0x0"
                  className={`rounded border px-2 py-1 font-mono text-sm disabled:bg-zinc-200 ${
                    valueValid
                      ? "border-gray-300"
                      : "border-red-500 bg-red-50 text-red-700"
                  }`}
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeRow(row.id)}
                  className="rounded border border-red-200 px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
                >
                  Remove
                </button>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-500">
            No {config.keyLabel.toLowerCase()} overrides added yet.
          </p>
        )}

        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Add Override
          </p>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
            <input
              type="text"
              value={draftKey}
              disabled={disabled}
              onChange={(event) => setDraftKey(event.target.value)}
              onBlur={() => {
                if (!draftKey.trim()) return;
                if (!config.validateKey(draftKey)) {
                  showNotice(config.keyHelperMessage);
                  return;
                }
                if (duplicateDraftKey) {
                  showNotice(
                    `That ${config.keyLabel.toLowerCase()} already has an override.`
                  );
                }
              }}
              placeholder={config.keyPlaceholder}
              className={`rounded border px-2 py-1 font-mono text-sm disabled:bg-zinc-200 ${
                draftKey.length === 0 || config.validateKey(draftKey)
                  ? "border-gray-300"
                  : "border-amber-400 bg-amber-50 text-amber-900"
              }`}
            />
            <input
              type="text"
              value={draftValue}
              disabled={disabled}
              onChange={(event) => setDraftValue(event.target.value)}
              onBlur={() => {
                if (draftValue.trim() && !isValidOverrideValue(draftValue)) {
                  showNotice(config.valueHelperMessage);
                }
              }}
              placeholder="0x0"
              className={`rounded border px-2 py-1 font-mono text-sm disabled:bg-zinc-200 ${
                draftValue.length === 0 || isValidOverrideValue(draftValue)
                  ? "border-gray-300"
                  : "border-amber-400 bg-amber-50 text-amber-900"
              }`}
            />
            <button
              type="button"
              disabled={addDisabled}
              onClick={handleAdd}
              className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Add
            </button>
          </div>
        </div>

        <div
          aria-live="polite"
          className={`rounded border px-3 py-2 text-xs ${
            draftKey.length > 0 && !config.validateKey(draftKey)
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : duplicateDraftKey || hasInvalidRows
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-gray-200 bg-gray-50 text-gray-600"
          }`}
        >
          {helperMessage}
        </div>
      </div>
    </div>
  );
}
