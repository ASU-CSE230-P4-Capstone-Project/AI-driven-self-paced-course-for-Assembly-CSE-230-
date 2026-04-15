'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TeacherDashboard } from "../components/TeacherDashboard";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../hooks/useAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function TeacherDashboardPage() {
  const { user, token, logout, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && isAuthenticated && user) {
      // Authoritative check (DB-backed): don't trust localStorage role.
      (async () => {
        try {
          const r = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const me = await r.json().catch(() => ({}));
          if (!r.ok || String(me?.role ?? "") !== "staff") {
            logout();
            router.replace("/login/student");
          }
        } catch {
          logout();
          router.replace("/login/student");
        }
      })();
    }
  }, [mounted, user, token, logout, isAuthenticated, loading, router]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <TeacherDashboard />
    </ProtectedRoute>
  );
}

