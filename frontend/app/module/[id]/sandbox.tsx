"use client";

import { useState } from "react";

export default function CodingSandbox() {
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");

  const handleRun = () => {
    setOutput("Running code...\n");

    setTimeout(() => {
      if (code.trim() === "") {
        setOutput("No code to execute. Please enter some code.");
      } else {
        setOutput(`Code executed successfully!\n\nOutput:\n${code}\n\n`);
      }
    }, 500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    alert("Code copied to clipboard!");
  };

  const handleClear = () => {
    setCode("");
    setOutput("");
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Code Editor</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear
            </button>
            <button
              type="button"
              onClick={handleRun}
              className="px-4 py-2 bg-[#800020] hover:bg-[#91173b] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run
            </button>
          </div>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter your MIPS assembly code here..."
          className="w-full h-64 p-4 border-2 border-[#800020]/30 rounded-lg font-mono text-sm text-gray-900 bg-white placeholder:text-gray-500 placeholder:opacity-100 caret-[#800020] focus:outline-none focus:ring-2 focus:ring-[#800020]/40 resize-none"
          spellCheck={false}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Output</h3>
          <button
            type="button"
            onClick={() => setOutput("")}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-sm font-medium transition-colors"
          >
            Clear
          </button>
        </div>
        <div className="w-full min-h-[12rem] p-4 border-2 border-gray-300 rounded-lg bg-gray-100 font-mono text-sm overflow-auto whitespace-pre-wrap text-gray-900">
          {output ? (
            output
          ) : (
            <span className="text-gray-500 select-none">Output will appear here after running your code...</span>
          )}
        </div>
      </div>
    </div>
  );
}
