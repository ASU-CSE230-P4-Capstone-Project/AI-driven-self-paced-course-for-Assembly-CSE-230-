import type { ReactNode } from "react";
import IdleTimeoutGate from "@/components/IdleTimeoutGate";

export default function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <IdleTimeoutGate timeoutMs={30 * 60 * 1000} redirectTo="/login">
      <div className="min-h-screen">{children}</div>
    </IdleTimeoutGate>
  );
}
