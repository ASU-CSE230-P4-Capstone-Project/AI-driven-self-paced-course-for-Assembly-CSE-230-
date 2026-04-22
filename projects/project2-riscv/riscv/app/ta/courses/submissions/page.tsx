'use client';

import { Suspense } from 'react';
import StaffLabSubmissionsPage from '@/components/staff-lab-submissions-page';

export default function TACourseSubmissionsPage() {
  return (
    <Suspense fallback={null}>
      <StaffLabSubmissionsPage variant="ta" />
    </Suspense>
  );
}
