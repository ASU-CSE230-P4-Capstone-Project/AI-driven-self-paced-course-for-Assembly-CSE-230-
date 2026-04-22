"use client";
import OverrideListEditor from "./override-list-editor";

type RegisterEditorProps = {
  registers: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
};

export default function RegisterEditor({ registers, onChange, disabled }: RegisterEditorProps) {
  return (
    <OverrideListEditor
      kind="register"
      title="Registers"
      overrides={registers}
      disabled={disabled}
      onChange={(nextOverrides) => {
        const previousKeys = new Set(Object.keys(registers));
        const nextKeys = new Set(Object.keys(nextOverrides));

        for (const key of previousKeys) {
          if (!nextKeys.has(key)) {
            onChange(key, "");
          }
        }

        for (const [key, value] of Object.entries(nextOverrides)) {
          if (registers[key] !== value) {
            onChange(key, value);
          }
        }
      }}
    />
  );
}
