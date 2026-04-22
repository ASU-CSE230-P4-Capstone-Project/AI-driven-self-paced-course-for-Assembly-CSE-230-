"use client";

import OverrideListEditor from "./override-list-editor";

type MemoryEditorProps = {
  memory: Record<string, string>;
  onChange: (nextMemory: Record<string, string>) => void;
  disabled?: boolean;
};

export default function MemoryEditor({
  memory,
  onChange,
  disabled = false,
}: MemoryEditorProps) {
  return (
    <OverrideListEditor
      kind="memory"
      title="Memory"
      overrides={memory}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
