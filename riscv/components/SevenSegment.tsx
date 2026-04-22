//7-seg
"use client";
import * as React from "react";

type Props = { hex: string; digits?: number };

export default function SevenSegment({ hex, digits = 4 }: Props) {
  const clean = (hex||"").replace(/^0x/i, "").toUpperCase();
  const padded = clean.padStart(digits, "0").slice(-digits);

  const segMap: Record<string, string[]> = {
    "0": ["a","b","c","d","e","f"], "1": ["b","c"], "2": ["a","b","g","e","d"],
    "3": ["a","b","g","c","d"], "4": ["f","g","b","c"], "5": ["a","f","g","c","d"],
    "6": ["a","f","e","d","c","g"], "7": ["a","b","c"], "8": ["a","b","c","d","e","f","g"],
    "9": ["a","b","c","d","f","g"], "A": ["a","b","c","e","f","g"], "B": ["c","d","e","f","g"],
    "C": ["a","d","e","f"], "D": ["b","c","d","e","g"], "E": ["a","d","e","f","g"], "F": ["a","e","f","g"],
  };

  return (
    <div className="flex gap-3">
      {padded.split("").map((ch, i) => {
        const on = new Set(segMap[ch] || []);
        return (
          <div key={i} className="relative w-14 h-24">
            <div className={`absolute left-2 right-2 top-0 h-2 rounded ${on.has("a")?"bg-sky-400":"bg-neutral-800"}`} />
            <div className={`absolute right-0 top-2 bottom-1/2 w-2 rounded ${on.has("b")?"bg-sky-400":"bg-neutral-800"}`} />
            <div className={`absolute right-0 top-1/2 bottom-2 w-2 rounded ${on.has("c")?"bg-sky-400":"bg-neutral-800"}`} />
            <div className={`absolute left-2 right-2 bottom-0 h-2 rounded ${on.has("d")?"bg-sky-400":"bg-neutral-800"}`} />
            <div className={`absolute left-0 top-1/2 bottom-2 w-2 rounded ${on.has("e")?"bg-sky-400":"bg-neutral-800"}`} />
            <div className={`absolute left-0 top-2 bottom-1/2 w-2 rounded ${on.has("f")?"bg-sky-400":"bg-neutral-800"}`} />
            <div className={`absolute left-2 right-2 top-1/2 -translate-y-1 h-2 rounded ${on.has("g")?"bg-sky-400":"bg-neutral-800"}`} />
          </div>
        );
      })}
    </div>
  );
}
