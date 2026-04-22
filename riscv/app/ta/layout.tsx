import type { ReactNode } from "react";
import IdleTimeoutGate from "@/components/IdleTimeoutGate";
import { InstructorStudioBackground } from "@/components/instructor-shell";

export default function TALayout({ children }: { children: ReactNode }) {
  return (
    <IdleTimeoutGate timeoutMs={30 * 60 * 1000} redirectTo="/login">
      <InstructorStudioBackground>{children}</InstructorStudioBackground>
    </IdleTimeoutGate>
  );
}
