'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Temporarily disable auth redirect for testing professor view
//FIX LATER
   // if (mounted && !loading && !isAuthenticated) {
   //   router.replace('/login');
   // }
  }, [mounted, isAuthenticated, loading, router]);
  //change back later
 // if (!mounted || loading || !isAuthenticated) {
 if (!mounted || loading ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
