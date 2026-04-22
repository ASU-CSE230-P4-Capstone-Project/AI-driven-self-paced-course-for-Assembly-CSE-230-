import { headers } from "next/headers";
import { redirect } from "next/navigation";
import StudentSettingsPanel from "@/components/student-settings-panel";
import { loadUserSettingsForUsername } from "@/app/api/user_settings/internal";
import { readVerifiedRequestAuth } from "@/app/verify/request-auth";

export default async function StudentSettingsPage() {
  const headerStore = await headers();
  const auth = readVerifiedRequestAuth(headerStore);

  if (!auth || auth.student !== true) {
    redirect("/login");
  }

  const result = await loadUserSettingsForUsername(auth.username);

  if (!result.authenticated) {
    redirect("/login");
  }

  return (
    <StudentSettingsPanel
      initialSettings={result.settings}
      initialSaveState={result.success ? "idle" : "error"}
      initialMessage={
        result.success
          ? "These preferences are saved to your account."
          : result.message ?? "Failed to load saved settings. Showing defaults."
      }
    />
  );
}
