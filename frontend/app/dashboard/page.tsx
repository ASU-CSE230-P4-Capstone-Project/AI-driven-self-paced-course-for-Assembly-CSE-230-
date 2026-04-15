'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from "../login/hooks/useAuth";
import { ProtectedRoute } from "../login/components/ProtectedRoute";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      // Redirect based on user role
      if (user.role === 'staff') {
        router.replace('/login/teacher');
      } else {
        router.replace('/login/student');
      }
    }
  }, [user, router]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </ProtectedRoute>
  );
}
