'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { LogOut, Users, BookOpen, BarChart3, FileText } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type CanvasSummary = {
  courseName?: string;
  canvas?: {
    totalStudents: number;
    totalPageViews: number;
    totalParticipations: number;
    avgPageViews: number;
    avgParticipations: number;
    moduleCount: number;
    source: string;
  };
};

export function TeacherDashboard() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<CanvasSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  useEffect(() => {
    if (!token) {
      setSummaryLoading(false);
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    fetch(`${API_URL}/canvas/teacher/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail =
            typeof data?.detail === 'string' ? data.detail : 'Could not load Canvas data.';
          throw new Error(detail);
        }
        return data as CanvasSummary;
      })
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setSummaryError(e.message);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const c = summary?.canvas;
  const totalStudents = c?.totalStudents ?? '—';
  const activeModules = c?.moduleCount ?? '—';
  const avgPageViews = c?.avgPageViews ?? '—';
  const totalParticipations = c?.totalParticipations ?? '—';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#800020] px-6 py-4 shadow-md">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 h-10 w-10 rounded flex items-center justify-center">
              <span className="text-[#800020] font-bold text-lg">CSE</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">CSE 230 Computer Systems</h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Button variant="outline" onClick={handleLogout} className="bg-transparent border-white text-white hover:bg-white hover:text-[#800020]">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {user?.name ?? user?.email ?? 'Professor'}!
          </h2>
          <p className="text-gray-600">
            {summary?.courseName
              ? `${summary.courseName} — Canvas-connected metrics`
              : 'Manage your course and monitor student progress'}
          </p>
          {summaryError && (
            <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Canvas: {summaryError}
            </p>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-900">Total Students</CardTitle>
              <Users className="h-4 w-4 text-[#800020]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {summaryLoading ? '…' : totalStudents}
              </div>
              <p className="text-xs text-gray-600">Students (Canvas)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-900">Course modules</CardTitle>
              <BookOpen className="h-4 w-4 text-[#800020]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {summaryLoading ? '…' : activeModules}
              </div>
              <p className="text-xs text-gray-600">Modules in this Canvas course</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-900">Avg page views</CardTitle>
              <BarChart3 className="h-4 w-4 text-[#800020]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {summaryLoading ? '…' : avgPageViews}
              </div>
              <p className="text-xs text-gray-600">Per student (Canvas analytics)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-900">Participations</CardTitle>
              <FileText className="h-4 w-4 text-[#800020]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {summaryLoading ? '…' : totalParticipations}
              </div>
              <p className="text-xs text-gray-600">Total across students (Canvas)</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions — use router.push so navigation works with static export / full-card hit area */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            role="link"
            tabIndex={0}
            onClick={() => router.push('/module/1')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push('/module/1');
              }
            }}
          >
            <CardHeader>
              <CardTitle className="text-gray-900">View Course Modules</CardTitle>
              <CardDescription className="text-gray-600">Browse and manage course content</CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            role="link"
            tabIndex={0}
            onClick={() => router.push('/login/teacher/students')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push('/login/teacher/students');
              }
            }}
          >
            <CardHeader>
              <CardTitle className="text-gray-900">Student Analytics</CardTitle>
              <CardDescription className="text-gray-600">
                Per-student page views and participations from Canvas
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-gray-900">Grade Submissions</CardTitle>
              <CardDescription className="text-gray-600">Review and grade student assignments</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-gray-900">Recent Activity</CardTitle>
            <CardDescription className="text-gray-600">Latest student submissions and progress updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Student completed Module 3</p>
                  <p className="text-sm text-gray-600">2 hours ago</p>
                </div>
                <span className="text-sm font-semibold text-green-600">92% Mastery</span>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">New submission: Module 2 Quiz</p>
                  <p className="text-sm text-gray-600">5 hours ago</p>
                </div>
                <span className="text-sm font-semibold text-blue-600">Pending Review</span>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Student reached Module 5</p>
                  <p className="text-sm text-gray-600">1 day ago</p>
                </div>
                <span className="text-sm font-semibold text-green-600">88% Mastery</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

