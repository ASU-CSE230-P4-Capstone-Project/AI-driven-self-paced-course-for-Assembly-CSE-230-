"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LabRoot from "@/components/lab_root";

export default function InstructorLabsRootPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const labUid = searchParams.get("lab");

  useEffect(() => {
    if (!labUid) {
      router.replace("/instructor/labs");
    }
  }, [labUid, router]);

  if (!labUid) return null;

  return <LabRoot />;
}
