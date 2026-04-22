'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const STUDENT_HOME_PRELOAD_ROUTES = [
  '/student/labs',
  '/student/projects',
  '/student/profile',
  '/student/settings',
  '/student/help',
  '/student/docs',
] as const;

export default function StudentHomeRoutePreloader() {
  const router = useRouter();
  const warmedRef = useRef(false);

  useEffect(() => {
    if (warmedRef.current) return;
    warmedRef.current = true;

    for (const route of STUDENT_HOME_PRELOAD_ROUTES) {
      router.prefetch(route);
    }
  }, [router]);

  return null;
}
