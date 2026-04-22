'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FiLogOut, FiMonitor } from 'react-icons/fi';
import { logout } from '@/app/logout/frontend';
import StaffGradeRosterPanel from '@/components/staff-grade-roster-panel';
import { ins } from '@/components/instructor-shell';
import { useStaffCourseSummaries } from '@/components/use-staff-course-summaries';

const courseActionClass =
  'inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 shadow-[0_10px_24px_rgba(180,120,20,0.12)] transition hover:-translate-y-px hover:border-amber-400 hover:bg-orange-50/80 hover:shadow-[0_14px_30px_rgba(180,120,20,0.16)]';

export default function TADashboardPage() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { summaries, loading, message } = useStaffCourseSummaries();

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className={`${ins.pageWrap} relative ta-shell`}>
      <div aria-hidden className="fixed inset-0 -z-10 bg-[#fff4e0]" />

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className={ins.kicker}>Teaching Assistant</p>
          <h1 className={`${ins.h1} mt-2`}>TA Dashboard</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/ta/simulator" className={`${ins.btnNeutral} gap-2 px-4 py-2.5`}>
            <FiMonitor className="h-4 w-4" aria-hidden />
            Open sandbox
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={
              isLoggingOut
                ? ins.btnDisabled
                : `${ins.btnSecondary} inline-flex items-center gap-2`
            }
          >
            <FiLogOut className="h-4 w-4" aria-hidden />
            {isLoggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </header>

      {message && <div className={ins.msgErr}>{message}</div>}

      <section aria-labelledby="ta-course-workbench" className={`${ins.card} ${ins.cardPad}`}>
        <div>
          <div>
            <p className={ins.kicker}>Assigned Courses</p>
            <h2 id="ta-course-workbench" className={`${ins.h2} mt-1`}>
              Course workbench
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-amber-100 bg-orange-50 py-12">
            <div className={ins.spinner} />
            <p className="mt-4 text-sm text-stone-600">Loading assigned courses...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-amber-100 bg-orange-50 p-6">
            <p className="text-sm text-stone-600">
              No active TA course assignments are available yet.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {summaries.map((summary) => (
              <article
                key={summary.course.course_id}
                className="rounded-2xl border border-amber-200/90 bg-white p-6 shadow-sm shadow-amber-950/10 ring-1 ring-amber-100/70"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className={ins.h2Card}>{summary.course.code}</h3>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                        {summary.course.course_id}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-700">{summary.course.title}</p>
                    {summary.course.term && (
                      <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">
                        {summary.course.term}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl border border-amber-100 bg-orange-50/70 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                        Students
                      </p>
                      <p className="mt-1 text-xl font-bold text-stone-900">
                        {summary.studentCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-orange-50/70 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                        Staff
                      </p>
                      <p className="mt-1 text-xl font-bold text-stone-900">
                        {summary.staffCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-orange-50/70 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                        Labs
                      </p>
                      <p className="mt-1 text-xl font-bold text-stone-900">
                        {summary.labCount}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <Link
                    href={`/ta/courses/labs?course_id=${encodeURIComponent(summary.course.course_id)}`}
                    className={courseActionClass}
                  >
                    Open
                  </Link>
                </div>

                <StaffGradeRosterPanel
                  portal="ta"
                  compact
                  fixedCourse={summary.course}
                  triggerLabel="Export lab grades"
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
