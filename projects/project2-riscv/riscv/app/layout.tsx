import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import TopRouteProgress from "@/components/top-route-progress";

export const metadata: Metadata = {
  title: "AssemblerLab — ASU RISC-V workspace",
  description:
    "Browser-based RISC-V assembly workspace for ASU courses: write, run, and submit assembly code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-neutral-600 text-gray-100">
        <Suspense fallback={null}>
          <TopRouteProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
