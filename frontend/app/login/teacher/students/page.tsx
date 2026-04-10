'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { ArrowLeft } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type StudentRow = {
  id: string;
  name: string;
  pageViews: number;
  participations: number;
};

export default function TeacherStudentAnalyticsPage() {
  const { user, token, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && isAuthenticated && user) {
      if (user.role !== 'professor' && user.role !== 'teacher') {
        router.replace('/login/student');
      }
    }
  }, [mounted, user, isAuthenticated, loading, router]);

  useEffect(() => {
    if (!token) {
      setLoadingData(false);
      return;
    }
    let cancelled = false;
    setLoadingData(true);
    setError(null);
    fetch(`${API_URL}/canvas/teacher/students`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail =
            typeof data?.detail === 'string' ? data.detail : 'Could not load student analytics.';
          throw new Error(detail);
        }
        return data as { students?: StudentRow[]; source?: string };
      })
      .then((data) => {
        if (!cancelled) {
          setRows(Array.isArray(data.students) ? data.students : []);
          setSource(data.source ?? null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white">
        <header className="bg-[#800020] px-6 py-4 shadow-md">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild className="bg-transparent border-white text-white hover:bg-white hover:text-[#800020]">
                <Link href="/login/teacher">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Link>
              </Button>
              <h1 className="text-xl font-bold text-white">Student analytics</h1>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-gray-600 mb-2">
            Per-student page views and participations from Canvas for your configured course.
          </p>
          {source && (
            <p className="text-xs text-gray-500 mb-4">
              Data source: {source === 'canvas_analytics_student_summaries' ? 'Canvas course analytics' : 'Roster only (analytics unavailable or disabled)'}
            </p>
          )}
          {error && (
            <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-semibold text-gray-900">Student</th>
                  <th className="text-right p-3 font-semibold text-gray-900">Page views</th>
                  <th className="text-right p-3 font-semibold text-gray-900">Participations</th>
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-500">
                      No students found for this course, or Canvas returned an empty list.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3 text-gray-900">{r.name}</td>
                      <td className="p-3 text-right tabular-nums">{r.pageViews}</td>
                      <td className="p-3 text-right tabular-nums">{r.participations}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
