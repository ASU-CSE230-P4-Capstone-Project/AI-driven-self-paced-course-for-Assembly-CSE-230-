'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, AlertTriangle, Compass } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useStudentDashboard } from '../hooks/useStudentDashboard';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "modules" | "activity">("overview");
  const { data, loading, error } = useStudentDashboard();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const atRiskTopics = useMemo(
    () => (data?.topics ?? []).filter((topic) => topic.masteryPercent < 60),
    [data],
  );

  const overallMasteryLabel = data ? `${Math.round(data.overallMastery)}%` : "—";
  const totalHoursLabel = data ? `${(data.totalTimeMinutes / 60).toFixed(1)}h` : "—";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#800020] px-4 sm:px-6 py-4 shadow-md">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 h-10 w-10 rounded flex items-center justify-center">
              <span className="text-[#800020] font-bold text-lg">CSE</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                CSE 230 Computer Systems
              </h1>
              <p className="text-xs sm:text-sm text-white/80">
                Mastery-based, AI-supported learning
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              size="sm"
              variant="outline"
              onClick={handleLogout}
              className="bg-transparent border-white text-white hover:bg-white hover:text-[#800020]"
            >
              <LogOut className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            Welcome back, {user?.name ?? user?.email ?? 'Student'}!
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">
            Track your mastery, review recent activity, and jump straight into the AI tutor.
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
                Overall Mastery
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                {overallMasteryLabel}
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-[#800020]/20 flex items-center justify-center">
                <span className="text-sm font-semibold text-[#800020]">
                  {data ? Math.round(data.overallMastery) : '--'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
                Time on Task
              </CardTitle>
              <CardDescription className="text-[11px] sm:text-xs">
                Total focused learning time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                {totalHoursLabel}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
                Active Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                {data?.topics.length ?? 0}
              </div>
              <p className="text-[11px] sm:text-xs text-gray-600 mt-1">
                With tracked mastery
              </p>
            </CardContent>
          </Card>

          <Card className={atRiskTopics.length > 0 ? 'border-red-500/60' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
                  At-Risk Topics
                </CardTitle>
                {atRiskTopics.length > 0 && (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl sm:text-3xl font-bold ${
                  atRiskTopics.length > 0 ? 'text-red-700' : 'text-gray-900'
                }`}
              >
                {atRiskTopics.length}
              </div>
              <p className="text-[11px] sm:text-xs text-gray-600 mt-1">
                {atRiskTopics.length > 0
                  ? 'Below 60% mastery'
                  : 'You are on track'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* At-risk alert banner */}
        {atRiskTopics.length > 0 && (
          <div className="mb-6 sm:mb-8 rounded-lg border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm sm:text-base font-semibold text-red-800">
                  You have topics that need attention.
                </p>
                <p className="text-xs sm:text-sm text-red-700 mt-1">
                  Focus on these areas to stay above the 60% mastery threshold.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {atRiskTopics.slice(0, 3).map((topic) => (
                <span
                  key={topic.id}
                  className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-red-800 border border-red-200"
                >
                  {topic.name}
                  <span className="ml-1 text-[11px] text-red-600">
                    {Math.round(topic.masteryPercent)}%
                  </span>
                </span>
              ))}
              {atRiskTopics.length > 3 && (
                <span className="text-xs text-red-700 font-medium">
                  +{atRiskTopics.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-6 sm:mb-8">
          {[
            { id: 'overview' as const, label: 'Overview' },
            { id: 'modules' as const, label: 'Modules & Mastery' },
            { id: 'activity' as const, label: 'Recent Activity' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'text-gray-900 border-[#800020]'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading / error states */}
        {loading && !data && (
          <div className="flex items-center justify-center py-10 text-gray-600 text-sm">
            Refreshing your latest progress…
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs sm:text-sm text-yellow-800">
            {error}
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mastery by topic */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-gray-900">Mastery by Topic</CardTitle>
                <CardDescription className="text-gray-600">
                  Each topic’s current mastery percentage. Alerts trigger below 60%.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data && data.topics.length > 0 ? (
                  <div className="space-y-3">
                    {data.topics.map((topic) => {
                      const percent = Math.round(topic.masteryPercent);
                      const isAtRisk = percent < 60;
                      const barColor = isAtRisk
                        ? 'bg-red-500'
                        : percent < 80
                        ? 'bg-yellow-500'
                        : 'bg-green-600';
                      return (
                        <div
                          key={topic.id}
                          className="rounded-md border border-gray-100 bg-white px-3 py-3"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {topic.name}
                              </span>
                              {isAtRisk && (
                                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 border border-red-100">
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  At risk
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {percent}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={`h-2 ${barColor}`}
                              style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
                            />
                          </div>
                          {topic.moduleId && (
                            <div className="mt-2 flex justify-end">
                              <Link
                                href={`/module/${topic.moduleId}`}
                                className="text-[11px] sm:text-xs text-[#800020] hover:underline inline-flex items-center gap-1"
                              >
                                <Compass className="h-3 w-3" />
                                Go to module
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    Start a mastery quiz or module to see topic-level analytics here.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick AI tutor access */}
            <Card>
              <CardHeader>
                <CardTitle className="text-gray-900">AI Tutor</CardTitle>
                <CardDescription className="text-gray-600">
                  Jump directly into the Socratic CourseTutor for any module.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link
                  href="/module/1/tutor"
                  className="block w-full rounded-md bg-[#800020] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-[#5f0018] transition-colors"
                >
                  Open Tutor for Module 1
                </Link>
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 font-medium">
                    Or choose a module:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((id) => (
                      <Link
                        key={id}
                        href={`/module/${id}/tutor`}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-center text-xs text-gray-800 hover:border-[#800020] hover:text-[#800020] transition-colors"
                      >
                        M{id}
                      </Link>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Use the tutor to clarify concepts, walk through examples, or prepare for
                  mastery checks in any topic.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'modules' && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
              Core Modules
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3].map((id) => (
                <Link
                  key={id}
                  href={`/module/${id}`}
                  className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow flex flex-col"
                >
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                    Module {id}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">
                    {id === 1 &&
                      'Abstraction layers, performance metrics, instruction sets, MIPS basics'}
                    {id === 2 &&
                      'MIPS registers, arithmetic operations, load/store instructions, memory addressing'}
                    {id === 3 &&
                      'Conditional branching, jump instructions, encoding MIPS to machine code'}
                  </p>
                  <div className="mt-auto space-y-2">
                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                      <span className="font-semibold text-gray-700">Progress</span>
                      <span className="text-gray-900 font-medium">
                        {id === 1 || id === 2 ? '100%' : '50%'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#800020] h-2 rounded-full"
                        style={{ width: id === 1 || id === 2 ? '100%' : '50%' }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-semibold text-gray-700 text-xs sm:text-sm">
                        Mastery Score
                      </span>
                      <span className="bg-[#800020] text-white px-3 py-0.5 rounded-full text-xs sm:text-sm font-semibold">
                        {id === 1 ? '92%' : id === 2 ? '88%' : '70%'}
                      </span>
                    </div>
                    <Link
                      href={`/module/${id}/tutor`}
                      className="mt-2 inline-flex items-center justify-center rounded-md border border-[#800020]/30 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-[#800020] hover:border-[#800020] transition-colors"
                    >
                      Ask AI Tutor
                    </Link>
                  </div>
                </Link>
              ))}

              {/* Locked modules remain static and purely presentational */}
              {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((id) => (
                <div
                  key={id}
                  className="bg-gray-100 border border-gray-300 rounded-lg p-5 relative opacity-60 cursor-not-allowed"
                >
                  <div className="absolute top-4 right-4">
                    <svg
                      className="w-6 h-6 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-500 mb-2">
                    Module {id}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Locked — complete earlier modules to unlock.
                  </p>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                      <span className="font-semibold text-gray-400">Progress</span>
                      <span className="text-gray-400 font-medium">Locked</span>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-2">
                      <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
              Recent Activity
            </h2>
            {data && data.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {data.recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {new Date(item.timestamp).toLocaleString()} • {item.type}
                        {typeof item.durationMinutes === 'number' &&
                          ` • ${item.durationMinutes} min`}
                        {typeof item.masteryChange === 'number' &&
                          ` • Mastery ${item.masteryChange > 0 ? '+' : ''}${
                            item.masteryChange
                          }%`}
                      </p>
                    </div>
                    {item.moduleId && (
                      <div className="flex gap-2 justify-end">
                        <Link
                          href={`/module/${item.moduleId}`}
                          className="text-xs sm:text-sm text-[#800020] hover:underline"
                        >
                          View module
                        </Link>
                        <Link
                          href={`/module/${item.moduleId}/tutor`}
                          className="text-xs sm:text-sm text-[#800020] hover:underline"
                        >
                          Ask tutor
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Once you complete readings, videos, or mastery quizzes, your recent activity
                timeline will appear here.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

