'use client';

import { Suspense } from 'react';
import StaffLabReviewPage from '@/components/staff-lab-review-page';

export default function InstructorWorkbenchStudentLabsRootPage() {
  return (
    <Suspense fallback={null}>
      <StaffLabReviewPage variant="instructor-workbench" />
    </Suspense>
  );
}
