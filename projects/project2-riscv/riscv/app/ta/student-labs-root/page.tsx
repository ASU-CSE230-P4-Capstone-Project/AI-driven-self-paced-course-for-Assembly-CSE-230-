"use client";

import { Suspense } from "react";
import StaffLabReviewPage from "@/components/staff-lab-review-page";

export default function TAStudentLabsRootPage() {
  return (
    <Suspense fallback={null}>
      <StaffLabReviewPage variant="ta" />
    </Suspense>
  );
}
