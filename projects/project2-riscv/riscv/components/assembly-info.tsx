// AssemblyInfo.tsx
"use client";
import React from "react";
import type { AssemblyInfoData, SubmitResponse } from "./types";
import {
  pickInterestingMemory,
  pickInterestingRegisters,
} from "./assembly-info-utils";

export default function AssemblyInfo({
  response,
  states = [],
  registerInputs = {},
  memoryInputs = {},
}: {
  response: AssemblyInfoData | null;
  states?: SubmitResponse["states"];
  registerInputs?: Record<string, string>;
  memoryInputs?: Record<string, string>;
}) {
  const hadError = response?.hadError ?? false;
  const errorMessage = response?.errorMessage ?? "";
  const filteredRegisters = React.useMemo(
    () => {
      if (!response) return {};

      return pickInterestingRegisters({
        current: response.registers,
        states,
        seed: registerInputs,
      });
    },
    [registerInputs, response, states]
  );
  const filteredMemory = React.useMemo(
    () => {
      if (!response) return {};

      return pickInterestingMemory({
        current: response.memory,
        states,
        seed: memoryInputs,
      });
    },
    [memoryInputs, response, states]
  );

  /**
   * ----------------------------
   * WHY WE NEED NUMERIC SORTING
   * ----------------------------
   * By default, JS object key iteration is string-based. That causes "x10" to come right after "x1"
   * (because "x10" < "x2" lexicographically), which is wrong for registers.
   *
   * We fix it by extracting the numeric part of the register name and comparing as numbers:
   *   "x2"  -> 2
   *   "x10" -> 10
   * so the order becomes x0, x1, x2, ... x9, x10, x11, ...
   *
   * Implementation details:
   * - We use a comparator for .sort(([a], [b]) => ...)
   * - We strip non-digits via a regex and parse the remainder in base 10
   * - If parsing fails (e.g., unexpected key), we fall back to string comparison to keep it stable
   */
  const sortedRegisters = Object.entries(filteredRegisters).sort(([a], [b]) => {
        // Extract the numeric suffix from keys like "x0", "x1", ..., "x31"
        // \D matches non-digits; replace them with "" to keep only digits
        const numA = parseInt(a.replace(/\D/g, ""), 10);
        const numB = parseInt(b.replace(/\D/g, ""), 10);

        // If both keys look like normal registers (x0..x31), compare numerically
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
          return numA - numB;
        }

        // Fallback: if keys are unusual (e.g., "pc"), or parsing failed,
        // do a stable-ish string compare so we still render deterministically.
        // Note: if you want "pc" at the top/bottom, you could special-case it here.
        return a.localeCompare(b, undefined, { numeric: true });
      });

  /**
   * ----------------------------
   * MEMORY ADDRESS SORTING (HEX)
   * ----------------------------
   * Memory addresses arrive as hex strings, e.g., "0x0", "0x4", "0x10".
   * Lexicographic order would place "0x10" before "0x4", which is wrong.
   *
   * We fix this by:
   * - Parsing each address as a base-16 integer
   * - Comparing the numeric addresses
   *
   * Implementation details:
   * - parseInt("0x10", 16) === 16
   * - We add graceful fallback if an address is not parseable (keep string order)
   */
  const sortedMemory = Object.entries(filteredMemory).sort(([a], [b]) => {
        const addrA = parseInt(a, 16);
        const addrB = parseInt(b, 16);

        if (!Number.isNaN(addrA) && !Number.isNaN(addrB)) {
          return addrA - addrB;
        }

        // Fallback if parse failed (unexpected format): keep a predictable order
        return a.localeCompare(b, undefined, { numeric: true });
      });

  return (
    <div className="w-full min-w-0 bg-zinc-900/60 border border-zinc-700 rounded-xl shadow-sm p-4 space-y-3 sm:max-w-[23.125rem] sm:min-w-[16rem]">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-300">
        <span>Assembly Info</span>
        <span
          className={`rounded px-2 py-0.5 font-semibold ${
            hadError
              ? "bg-red-900/40 text-red-200 border border-red-700/60"
              : "bg-emerald-900/30 text-emerald-200 border border-emerald-700/40"
          }`}
        >
          {hadError ? "Error" : "OK"}
        </span>
      </div>

      <div
        className={`rounded px-2.5 py-1.5 text-sm ${
          hadError
            ? "bg-red-900/30 text-red-100 border border-red-700/50"
            : "bg-emerald-900/20 text-emerald-100 border border-emerald-700/30"
        }`}
      >
        {hadError ? errorMessage || "Unknown error" : "No errors"}
      </div>

      <p className="text-xs text-zinc-400">
        Showing seeded inputs and state that changed during the run.
      </p>

      <div className="space-y-3 text-sm">
        {/* ----------------- REGISTERS PANEL ----------------- */}
        <div className="rounded-lg border border-zinc-700/60 bg-zinc-950/40 p-2">
          <p className="font-semibold mb-1 text-xs uppercase tracking-wide text-zinc-400">
            Registers
          </p>

          <div className="max-h-44 overflow-auto pr-1 text-sm font-mono text-zinc-100">
            {sortedRegisters.length > 0 ? (
              sortedRegisters.map(([name, hex]) => (
                <p key={name} className="leading-5">
                  {name}: {hex}
                </p>
              ))
            ) : (
              <p className="text-zinc-500">—</p>
            )}
          </div>
        </div>

        {/* ------------------- MEMORY PANEL ------------------- */}
        <div className="rounded-lg border border-zinc-700/60 bg-zinc-950/40 p-2">
          <p className="font-semibold mb-1 text-xs uppercase tracking-wide text-zinc-400">
            Memory
          </p>

          <div className="max-h-44 overflow-auto pr-1 text-sm font-mono text-zinc-100">
            {sortedMemory.length > 0 ? (
              sortedMemory.map(([addr, hex]) => (
                <p key={addr} className="leading-5">
                  {addr}: {hex}
                </p>
              ))
            ) : (
              <p className="text-zinc-500">—</p>
            )}
          </div>
        </div>
      </div>

      {/*
        -------------------- NOTES / EXTENSIBILITY --------------------
        - If your backend ever includes special keys like "pc" in registers,
          and you want "pc" always first, you can special-case it in the
          comparator, e.g.:
            if (a === "pc") return -1;
            if (b === "pc") return 1;
        - If you have large maps, consider memoizing the sorted arrays with
          useMemo to avoid re-sorting on every render when `response`
          doesn't change.
        - If memory keys can be mixed-case ("0xA" vs "0xa"), parseInt handles
          both fine; rendering can normalize to lowercase if desired.
      */}
    </div>
  );
}
