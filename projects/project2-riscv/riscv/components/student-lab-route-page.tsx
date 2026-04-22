"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import StudentLabLoadingShell from "@/components/student-lab-loading-shell";

const LabRoot = dynamic(() => import("@/components/lab_root"), {
  ssr: false,
  loading: () => <StudentLabLoadingShell />,
});

type StudentLabRoutePageProps = {
  courseId: string;
  labUid: string;
  sessionUsername?: string | null;
};

export default function StudentLabRoutePage({
  courseId,
  labUid,
  sessionUsername,
}: StudentLabRoutePageProps) {
  const router = useRouter();

  useEffect(() => {
    if (courseId && labUid) return;
    router.replace("/student/labs");
  }, [courseId, labUid, router]);

  if (!courseId || !labUid) {
    return <StudentLabLoadingShell label="Returning to labs..." />;
  }

  return (
    <LabRoot
      courseIdOverride={courseId}
      labUidOverride={labUid}
      sessionUsername={sessionUsername}
    />
  );
}
