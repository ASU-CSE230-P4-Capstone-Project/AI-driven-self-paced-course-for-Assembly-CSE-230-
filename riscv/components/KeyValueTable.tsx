'use client';

import { useState, useCallback } from 'react';

// Validation functions
const isValidRegister = (key: string): boolean => {
  const match = key.toLowerCase().match(/^x(\d+)$/);
  if (!match) return false;
  const num = parseInt(match[1], 10);
  return num >= 0 && num <= 31;
};

const isValidHexAddress = (key: string): boolean => {
  if (!/^0x[0-9a-fA-F]+$/.test(key)) return false;
  // Check that address is within 1024 bytes (0x0 to 0x3FF)
  const addr = parseInt(key, 16);
  return addr >= 0 && addr < 1024;
};

const isValidHexValue = (value: string): boolean => {
  if (!/^0x[0-9a-fA-F]+$/.test(value)) return false;
  // Check that value fits in 4 bytes (32 bits)
  const num = parseInt(value, 16);
  return num >= 0 && num <= 0xFFFFFFFF;
};

export type KeyValueEntry = {
  id: string; // unique id for React key
  key: string;
  value: string;
};

export type KeyValueTableProps = {
  title: string;
  type: 'registers' | 'memory';
  entries: KeyValueEntry[];
  onChange: (entries: KeyValueEntry[]) => void;
  disabled?: boolean;
};

export default function KeyValueTable({
  title,
  type,
  entries,
  onChange,
  disabled = false,
}: KeyValueTableProps) {
  // Generate unique ID for new entries
  const generateId = () => `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const validateKey = useCallback((key: string): boolean => {
    if (!key) return false;
    return type === 'registers' ? isValidRegister(key) : isValidHexAddress(key);
  }, [type]);

  const validateValue = useCallback((value: string): boolean => {
    if (!value) return false;
    return isValidHexValue(value);
  }, []);

  const handleKeyChange = (id: string, newKey: string) => {
    const updated = entries.map(entry =>
      entry.id === id ? { ...entry, key: newKey } : entry
    );
    onChange(updated);
  };

  const handleValueChange = (id: string, newValue: string) => {
    const updated = entries.map(entry =>
      entry.id === id ? { ...entry, value: newValue } : entry
    );
    onChange(updated);
  };

  const handleAddRow = () => {
    const newEntry: KeyValueEntry = {
      id: generateId(),
      key: type === 'registers' ? 'x0' : '0x0',
      value: '0x0',
    };
    onChange([...entries, newEntry]);
  };

  const handleDeleteRow = (id: string) => {
    if (!window.confirm(`Delete this row from "${title}"?`)) {
      return;
    }

    onChange(entries.filter(entry => entry.id !== id));
  };

  return (
    <div className="border border-gray-300 rounded-md p-3 bg-white">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        <button
          type="button"
          onClick={handleAddRow}
          disabled={disabled}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          + Add Row
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No entries. Click "Add Row" to add one.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-1 px-2 text-gray-600 font-medium">
                {type === 'registers' ? 'Register' : 'Address'}
              </th>
              <th className="text-left py-1 px-2 text-gray-600 font-medium">Value</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const keyValid = validateKey(entry.key);
              const valueValid = validateValue(entry.value);

              return (
                <tr key={entry.id} className="border-b border-gray-100">
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      value={entry.key}
                      onChange={(e) => handleKeyChange(entry.id, e.target.value)}
                      disabled={disabled}
                      className={`w-full px-2 py-1 text-sm border rounded font-mono ${
                        keyValid
                          ? 'border-gray-300 focus:border-blue-500 text-black'
                          : 'border-red-500 bg-red-50 text-red-700'
                      } focus:outline-none disabled:bg-gray-100`}
                      placeholder={type === 'registers' ? 'x0' : '0x0'}
                    />
                  </td>
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      value={entry.value}
                      onChange={(e) => handleValueChange(entry.id, e.target.value)}
                      disabled={disabled}
                      className={`w-full px-2 py-1 text-sm border rounded font-mono ${
                        valueValid
                          ? 'border-gray-300 focus:border-blue-500 text-black'
                          : 'border-red-500 bg-red-50 text-red-700'
                      } focus:outline-none disabled:bg-gray-100`}
                      placeholder="0x0"
                    />
                  </td>
                  <td className="py-1 px-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(entry.id)}
                      disabled={disabled}
                      className="text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                      title="Delete row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Helper to check if all entries in a table are valid
export function areEntriesValid(entries: KeyValueEntry[], type: 'registers' | 'memory'): boolean {
  if (entries.length === 0) return true;
  
  for (const entry of entries) {
    const keyValid = type === 'registers' ? isValidRegister(entry.key) : isValidHexAddress(entry.key);
    const valueValid = isValidHexValue(entry.value);
    if (!keyValid || !valueValid) return false;
  }
  return true;
}

// Helper to convert entries to JSON object string
export function entriesToJson(entries: KeyValueEntry[]): string {
  const obj: Record<string, string> = {};
  for (const entry of entries) {
    // Normalize register keys to lowercase
    const key = entry.key.toLowerCase();
    obj[key] = entry.value;
  }
  return JSON.stringify(obj);
}

// Helper to convert JSON object string to entries
export function jsonToEntries(json: string): KeyValueEntry[] {
  try {
    const obj = JSON.parse(json);
    if (typeof obj !== 'object' || obj === null) return [];
    
    return Object.entries(obj).map(([key, value]) => ({
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      key: key,
      value: String(value),
    }));
  } catch {
    return [];
  }
}
