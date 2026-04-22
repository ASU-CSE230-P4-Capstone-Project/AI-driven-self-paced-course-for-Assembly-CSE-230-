'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FiBook,
  FiClipboard,
  FiLayers,
  FiLogOut,
  FiMonitor,
  FiShield,
} from 'react-icons/fi';
import { logout } from '@/app/logout/frontend';
import StaffGradeRosterPanel from '@/components/staff-grade-roster-panel';
import { ins } from '@/components/instructor-shell';
import { useStaffCourseSummaries } from '@/components/use-staff-course-summaries';

type AdminCard = {
  title: string;
  description: string;
  icon: typeof FiLayers;
  actions: Array<{ href: string; label: string; tone?: 'primary' | 'secondary' | 'neutral' }>;
};

const ADMIN_CARDS: AdminCard[] = [
  {
    title: 'Course Administration',
    description: 'Set up sections, edit course details, and manage enrollment workflows.',
    icon: FiLayers,
    actions: [
      { href: '/instructor/courses/create', label: 'Create course', tone: 'primary' },
      { href: '/instructor/courses', label: 'View / edit courses', tone: 'secondary' },
      { href: '/instructor/courses/add_member', label: 'Add user to course' },
      { href: '/instructor/courses/drop_member', label: 'Remove user from course' },
    ],
  },
  {
    title: 'Lab Administration',
    description: 'Maintain lab content, update test cases, and open the simulator.',
    icon: FiBook,
    actions: [
      { href: '/instructor/labs', label: 'View / edit labs', tone: 'primary' },
      { href: '/instructor/simulator', label: 'Open Simulator Sandbox' },
    ],
  },
  {
    title: 'Access Management',
    description: 'Maintain user accounts, roles, and staff permissions for the teaching team.',
    icon: FiShield,
    actions: [
      { href: '/instructor/manage_roles', label: 'Manage roles', tone: 'primary' },
      { href: '/instructor/user_search', label: 'Search users', tone: 'secondary' },
      { href: '/instructor/create_user', label: 'Create user' },
    ],
  },
];

const coursePrimaryActionClass =
  'inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-50';

function DashboardSectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4" aria-hidden>
      <div className="h-px flex-1 bg-amber-200" />
      <span className="rounded-full border border-amber-200 bg-white/90 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900 shadow-sm">
        {label}
      </span>
      <div className="h-px flex-1 bg-amber-200" />
    </div>
  );
}

export default function InstructorPage() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { summaries, loading, message } = useStaffCourseSummaries();
  const solidAccentBadgeClass =
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm';
  const solidAccentBadgeSmallClass =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm';

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
    <div className={ins.pageWrap}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className={ins.kicker}>Instructor</p>
          <h1 className={`${ins.h1} mt-2`}>Instructor Dashboard</h1>
          <p className={`${ins.subtitle} max-w-3xl`}>
            Check in on assigned courses first, then use the admin tools below for setup,
            content, and account management.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/instructor/simulator" className={`${ins.btnSecondary} gap-2`}>
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

      <section aria-labelledby="instructor-section" className="space-y-6">
        <DashboardSectionDivider label="Instructor Section" />

        <article className={`${ins.card} ${ins.cardPad}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <span className={solidAccentBadgeClass}>
                <FiClipboard className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className={ins.kicker}>Assigned Courses</p>
                <h2 id="instructor-section" className={`${ins.h2} mt-1`}>
                  Course workbench
                </h2>
                <p className={`${ins.subtitleMuted} mt-2 max-w-2xl`}>
                  Use this to check course health, open rosters, inspect grades, and review lab
                  submissions without drifting into setup and structure changes.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 flex flex-col items-center rounded-2xl border border-amber-100 bg-orange-50/50 py-12">
              <div className={ins.spinner} />
              <p className="mt-4 text-sm text-stone-600">Loading assigned courses...</p>
            </div>
          ) : summaries.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-100 bg-orange-50/50 p-6">
              <p className="text-sm text-stone-600">
                No active instructor course assignments are available yet. Admin tools stay
                available below.
              </p>
            </div>
          ) : (
            <>
              <section className="mt-6 grid gap-5 xl:grid-cols-2">
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

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link
                        href={`/instructor/workbench/courses/labs?course_id=${encodeURIComponent(summary.course.course_id)}`}
                        className={coursePrimaryActionClass}
                      >
                        Open workbench
                      </Link>
                    </div>

                    <StaffGradeRosterPanel
                      portal="instructor"
                      compact
                      fixedCourse={summary.course}
                      triggerLabel="Export lab grades"
                    />
                  </article>
                ))}
              </section>
            </>
          )}
        </article>
      </section>

      <section aria-labelledby="admin-section" className="space-y-6">
        <DashboardSectionDivider label="Admin Section" />

        <div className="flex items-start gap-4">
          <span className={solidAccentBadgeClass}>
            <FiShield className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className={ins.kicker}>Platform Management</p>
            <h2 id="admin-section" className={`${ins.h2} mt-1`}>
              Admin tools
            </h2>
            <p className={`${ins.subtitleMuted} mt-2 max-w-3xl`}>
              These actions change course setup, lab content, or account permissions rather than
              day-to-day course review.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {ADMIN_CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.title}
                className={`${ins.card} ${ins.cardPad} flex flex-col transition hover:border-amber-300 hover:shadow-md`}
              >
                <div className="flex items-start gap-4">
                  <span className={solidAccentBadgeSmallClass}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={ins.kicker}>{card.title}</p>
                    <h3 className={`${ins.h2Card} mt-1`}>{card.title}</h3>
                    <p className={`${ins.subtitleMuted} mt-2`}>{card.description}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-amber-100 pt-5">
                  {card.actions.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className={
                        action.tone === 'primary'
                          ? ins.btnPrimary
                          : action.tone === 'secondary'
                            ? ins.btnSecondary
                            : ins.btnNeutral
                      }
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
