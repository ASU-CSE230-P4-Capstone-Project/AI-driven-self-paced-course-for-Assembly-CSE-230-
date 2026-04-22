"use client";
import * as React from "react";
import SevenSegment from "./SevenSegment";
import Led from "./Led";

type MemoryMap = Record<string, string | number>;

const MEMORY_BYTES = 1024;
const WORD_BYTES = 4;
const MAX_TRACK_ADDRESS = MEMORY_BYTES - WORD_BYTES;

function formatAddress(value: number) {
  return `0x${value.toString(16)}`;
}

function hexifyWord(value: number) {
  return `0x${(value >>> 0).toString(16)}`;
}

function parseMemoryByte(v: string | number | undefined) {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v & 0xff;
  const parsed = v.trim().toLowerCase().startsWith("0x")
    ? parseInt(v, 16)
    : Number(v);
  return Number.isFinite(parsed) ? parsed & 0xff : 0;
}

function normalizeTrackAddress(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(trimmed)) return null;

  const address = parseInt(trimmed, 16);
  if (
    !Number.isFinite(address) ||
    address < 0 ||
    address > MAX_TRACK_ADDRESS ||
    address % WORD_BYTES !== 0
  ) {
    return null;
  }

  return formatAddress(address);
}

function readWord(memory: MemoryMap | null, addressKey: string) {
  if (!memory) return 0;

  const address = parseInt(addressKey, 16);
  if (!Number.isFinite(address)) return 0;

  const byte0 = parseMemoryByte(memory[formatAddress(address)]);
  const byte1 = parseMemoryByte(memory[formatAddress(address + 1)]);
  const byte2 = parseMemoryByte(memory[formatAddress(address + 2)]);
  const byte3 = parseMemoryByte(memory[formatAddress(address + 3)]);

  return (byte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24)) >>> 0;
}

export default function MemoryVisualPanel({
  memory,
  trackAddress = "0x0",
  digits = 4,
}: {
  memory: MemoryMap | null;
  trackAddress?: string;
  digits?: number;
}) {
  const [selectedAddress, setSelectedAddress] = React.useState(trackAddress);
  const [inputValue, setInputValue] = React.useState(trackAddress);
  const [isEditing, setIsEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const normalized = normalizeTrackAddress(trackAddress) ?? "0x0";
    setSelectedAddress(normalized);
    setInputValue(normalized);
  }, [trackAddress]);

  const valueNum = React.useMemo(
    () => readWord(memory, selectedAddress),
    [memory, selectedAddress]
  );
  const valueHex = React.useMemo(() => hexifyWord(valueNum), [valueNum]);

  const commitInput = React.useCallback(() => {
    const normalized = normalizeTrackAddress(inputValue);
    if (!normalized) {
      setError("Address must be a 4-byte aligned hex value from 0x0 through 0x3fc.");
      return;
    }
    setSelectedAddress(normalized);
    setInputValue(normalized);
    setIsEditing(false);
    setError(null);
  }, [inputValue]);

  return (
    <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-100">
            Memory-Mapped Display & LEDs
          </h3>
          <p className="text-neutral-400 text-sm">
            Tracking word at{" "}
            <span className="font-mono">
              {isEditing ? (
                <input
                  className="bg-neutral-800 text-neutral-100 border border-neutral-700 rounded px-2 py-0.5 text-sm w-24"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onBlur={commitInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitInput();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setInputValue(selectedAddress);
                      setIsEditing(false);
                      setError(null);
                    }
                  }}
                  autoFocus
                  aria-label="Memory address to track"
                />
              ) : (
                <button
                  type="button"
                  className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-sm hover:border-neutral-500"
                  onClick={() => {
                    setInputValue(selectedAddress);
                    setIsEditing(true);
                  }}
                >
                  {selectedAddress}
                </button>
              )}
            </span>{" "}
            = <span className="font-mono">{valueHex.toUpperCase()}</span>
          </p>
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
      </div>

      <div className="mt-4">
        <SevenSegment hex={valueHex} digits={digits} />
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Led on={valueNum > 0} label={`${selectedAddress}>0`} />
        <Led on={(valueNum & 0x1) !== 0} label="bit0" />
        <Led on={(valueNum & 0x2) !== 0} label="bit1" />
        <Led on={(valueNum & 0x4) !== 0} label="bit2" />
        <Led on={(valueNum & 0x8) !== 0} label="bit3" />
      </div>
    </div>
  );
}
