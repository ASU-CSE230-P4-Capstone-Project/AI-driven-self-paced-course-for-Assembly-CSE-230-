'use client';

import { Suspense } from 'react';
import StaffLabSubmissionsPage from '@/components/staff-lab-submissions-page';

export default function InstructorCourseSubmissionsPage() {
  return (
    <Suspense fallback={null}>
      <StaffLabSubmissionsPage variant="instructor-admin" />
    </Suspense>
  );
}
