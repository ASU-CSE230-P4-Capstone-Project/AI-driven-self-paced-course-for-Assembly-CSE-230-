"use client";
import React from "react";
import dynamic from "next/dynamic";

const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[32rem] items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/60 text-sm text-zinc-400">
      Loading editor...
    </div>
  ),
});

type EditorPanelProps = {
  projectName: string;
  projectDescription?: string;
  code: string;
  onCodeChange: (nextCode: string) => void;
  showHeader?: boolean;
  editorFontSize?: number;
  editorHeight?: string;
};

const EditorPanel: React.FC<EditorPanelProps> = ({
  projectName,
  projectDescription,
  code,
  onCodeChange,
  showHeader = true,
  editorFontSize,
  editorHeight,
}) => {
  return (
    <>
      {showHeader && (
        <div className="mb-2">
          <div className="text-xs font-semibold text-zinc-200">{projectName}</div>
          {projectDescription && (
            <div className="text-[11px] text-zinc-400 truncate">
              {projectDescription}
            </div>
          )}
        </div>
      )}

      {/* EDITOR */}
      <CodeEditor
        code={code}
        onChange={onCodeChange}
        fontSize={editorFontSize}
        height={editorHeight}
      />
    </>
  );
};

export default EditorPanel;
