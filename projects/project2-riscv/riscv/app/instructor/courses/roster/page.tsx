'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getCourseMembers } from '@/app/api/course_members/frontend';
import { listCourses } from '@/app/api/list_courses/frontend';
import { removeCourseMember } from '@/app/api/remove_course_member/frontend';
import type { CourseMember } from '@/app/api/course_members/types';
import type { Course } from '@/app/api/list_courses/types';
import { ins } from '@/components/instructor-shell';

function CourseRosterContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('course_id') ?? '';
  const hasValidCourseId = /^[0-9]{5}$/.test(courseId);
  const backHref = hasValidCourseId
    ? `/instructor/courses/labs?course_id=${encodeURIComponent(courseId)}`
    : '/instructor/courses';
  const [course, setCourse] = useState<Course | null>(null);
  const [members, setMembers] = useState<CourseMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !hasValidCourseId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const [coursesRes, membersRes] = await Promise.all([
          listCourses(),
          getCourseMembers(courseId),
        ]);

        if (cancelled) return;

        if (coursesRes.success && coursesRes.courses) {
          setCourse(coursesRes.courses.find((entry) => entry.course_id === courseId) ?? null);
        } else {
          setCourse(null);
        }

        if (membersRes.success && membersRes.members) {
          setMembers(membersRes.members);
        } else {
          setMembers([]);
          if (membersRes.message) {
            setMessage({ success: false, text: membersRes.message });
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, hasValidCourseId]);

  const studentCount = useMemo(
    () => members.filter((member) => member.role === 'student').length,
    [members]
  );
  const staffCount = useMemo(
    () => members.filter((member) => member.role !== 'student').length,
    [members]
  );

  const handleRemove = async (username: string) => {
    const courseLabel = course ? `${course.code} — ${course.title}` : `course ${courseId}`;
    if (!window.confirm(`Remove "${username}" from ${courseLabel}?`)) {
      return;
    }

    setMessage(null);
    setRemoving(username);
    try {
      const result = await removeCourseMember({ course_id: courseId, username });
      setMessage({
        success: result.success,
        text: result.message || (result.success ? 'Member removed.' : 'Failed to remove member.'),
      });
      if (result.success) {
        setMembers((current) => current.filter((member) => member.username !== username));
      }
    } catch (error) {
      setMessage({
        success: false,
        text: error instanceof Error ? error.message : 'Failed to remove member.',
      });
    } finally {
      setRemoving(null);
    }
  };

  if (!courseId || !hasValidCourseId) {
    return (
      <div className={`${ins.pageWrapMd} max-w-3xl`}>
        <Link href={backHref} className={ins.backLink}>
          ← Back to courses
        </Link>
        <p className="mt-4 text-stone-600">Invalid course.</p>
      </div>
    );
  }

  return (
    <div className={ins.pageWrapWide}>
      <Link href={backHref} className={ins.backLink}>
        ← Back to course labs
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className={ins.kicker}>Course Roster</p>
          <h1 className={`${ins.h1} mt-2`}>Manage enrollment</h1>
          <p className={ins.subtitle}>
            {course ? `${course.code} — ${course.title}` : `Course ${courseId}`}
          </p>
          {course?.term && <p className="mt-1 text-sm text-stone-600">{course.term}</p>}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/instructor/courses/add_member?course_id=${encodeURIComponent(courseId)}`}
            className={ins.btnPrimary}
          >
            Add user
          </Link>
        </div>
      </header>

      {message && (
        <div className={message.success ? ins.msgOk : ins.msgErr}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className={`${ins.card} ${ins.cardPad} flex flex-col items-center py-12`}>
          <div className={ins.spinner} />
          <p className="mt-4 text-sm text-stone-600">Loading roster...</p>
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <article className={`${ins.card} ${ins.cardPad}`}>
              <p className={ins.labelCaps}>Members</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                {members.length}
              </p>
              <p className="mt-2 text-sm text-stone-600">Total active memberships in this course.</p>
            </article>

            <article className={`${ins.card} ${ins.cardPad}`}>
              <p className={ins.labelCaps}>Students</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                {studentCount}
              </p>
              <p className="mt-2 text-sm text-stone-600">Student accounts that can submit work.</p>
            </article>

            <article className={`${ins.card} ${ins.cardPad}`}>
              <p className={ins.labelCaps}>Staff</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                {staffCount}
              </p>
              <p className="mt-2 text-sm text-stone-600">Instructor and TA accounts assigned here.</p>
            </article>
          </section>

          <section className={`${ins.card} overflow-hidden`}>
            <div className="border-b border-amber-100 px-6 py-5">
              <h2 className={ins.h2Card}>Members</h2>
              <p className="mt-1 text-sm text-stone-600">
                Review enrollment, roles, and remove course members when structure changes.
              </p>
            </div>

            {members.length === 0 ? (
              <div className="px-6 py-8 text-sm text-stone-600">
                No members are enrolled in this course yet.
              </div>
            ) : (
              <ul className={ins.divideList}>
                {members.map((member) => (
                  <li
                    key={member.username}
                    className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-semibold text-stone-900">{member.username}</p>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                          {member.role}
                        </span>
                        {member.status && (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-stone-700">
                            {member.status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRemove(member.username)}
                        disabled={removing === member.username}
                        className={ins.btnDanger}
                      >
                        {removing === member.username ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function CourseRosterPage() {
  return (
    <Suspense
      fallback={
        <div className={`${ins.pageWrapMd} text-stone-600`}>
          <p>Loading...</p>
        </div>
      }
    >
      <CourseRosterContent />
    </Suspense>
  );
}
