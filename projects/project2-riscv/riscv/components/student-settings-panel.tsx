"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { saveUserSettings } from "@/app/api/user_settings/frontend";
import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from "@/app/api/user_settings/types";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

type StudentSettingsPanelProps = {
  initialSettings?: UserSettings;
  initialSaveState?: SaveState;
  initialMessage?: string;
};

export default function StudentSettingsPanel({
  initialSettings = DEFAULT_USER_SETTINGS,
  initialSaveState = "idle",
  initialMessage = "These preferences are saved to your account.",
}: StudentSettingsPanelProps) {
  const router = useRouter();
  const [settings, setSettings] = React.useState<UserSettings>(initialSettings);
  const [saveState, setSaveState] = React.useState<SaveState>(initialSaveState);
  const [message, setMessage] = React.useState(initialMessage);

  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSaveState("idle");
    setMessage("You have unsaved changes.");
  };

  const handleSave = async () => {
    setSaveState("saving");
    setMessage("Saving your settings...");

    const response = await saveUserSettings(settings);
    if (!response.success || !response.settings) {
      setSaveState("error");
      setMessage(response.message ?? "Failed to save settings.");
      return;
    }

    setSettings(response.settings);
    setSaveState("saved");
    setMessage("Settings saved for your account.");
    router.refresh();
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_USER_SETTINGS);
    setSaveState("idle");
    setMessage("Defaults restored locally. Save to apply them to your account.");
  };

  const statusClassName =
    saveState === "error"
      ? "border-red-500/40 bg-red-950/30 text-red-100"
      : saveState === "saved"
        ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
        : "border-zinc-700 bg-zinc-900/50 text-zinc-200";

  return (
    <div className="mx-auto max-w-4xl py-5">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <div className={`mt-5 rounded-xl border p-4 text-sm ${statusClassName}`}>
        {message}
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-700 bg-zinc-900/40 p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Editor</h2>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-100">Editor Font Size</p>
                <p className="mt-1 text-sm text-zinc-400">
                  Controls the code editor text size on lab pages.
                </p>
              </div>
              <span className="rounded-md border border-zinc-600 px-3 py-1 text-sm text-zinc-200">
                {settings.editorFontSize}px
              </span>
            </div>
            <input
              type="range"
              min={12}
              max={24}
              step={1}
              value={settings.editorFontSize}
              onChange={(event) =>
                updateSetting("editorFontSize", Number(event.target.value))
              }
              className="mt-4 w-full accent-[#460808]"
            />
          </div>

          <SettingToggle
            title="Open Lab Instructions By Default"
            description="Keep the yellow instructions panel open when a lab first loads."
            checked={settings.openInstructionsByDefault}
            onChange={(checked) =>
              updateSetting("openInstructionsByDefault", checked)
            }
          />

          <SettingToggle
            title="Warn Before Reinstating Submission Code"
            description="Require a confirmation before replacing the current editor contents from past submissions."
            checked={settings.warnBeforeReinstate}
            onChange={(checked) =>
              updateSetting("warnBeforeReinstate", checked)
            }
          />
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="rounded-md bg-[#ffb86a] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {saveState === "saving" ? "Saving..." : "Save Settings"}
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          disabled={saveState === "saving"}
          className="rounded-md border border-zinc-500 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reset To Defaults
        </button>
      </div>
    </div>
  );
}

type SettingToggleProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function SettingToggle({
  title,
  description,
  checked,
  onChange,
}: SettingToggleProps) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-zinc-700 bg-zinc-950/30 p-4">
      <div>
        <p className="text-sm font-medium text-zinc-100">{title}</p>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 rounded border-zinc-500 bg-zinc-900 accent-[#460808]"
      />
    </label>
  );
}
