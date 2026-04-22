import type { ReactNode } from "react";
import Sidebar from "@/components/sidebar";

export default function StudentShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[rgb(82,82,82)] text-zinc-100 flex">
      <Sidebar initialOpen={false} />
      <main className="flex-1 relative px-4 pt-16 sm:px-6 md:pl-23 md:pt-0">{children}</main>
    </div>
  );
}
