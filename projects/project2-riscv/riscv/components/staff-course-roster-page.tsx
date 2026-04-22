"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getCourseLabs, type CourseLab } from "@/app/api/course_labs/frontend";
import { getCourseMembers } from "@/app/api/course_members/frontend";
import type { CourseMember } from "@/app/api/course_members/types";
import { listStaffCourses } from "@/app/api/staff_courses/frontend";
import type { Course } from "@/app/api/list_courses/types";
import CourseRosterReviewLauncher from "@/components/course-roster-review-launcher";
import { ins } from "@/components/instructor-shell";
import {
  getStaffCourseBaseHref,
  getStaffCoursesHref,
  type StaffWorkflowVariant,
} from "@/components/staff-workflow";

type StaffCourseRosterPageProps = {
  variant: StaffWorkflowVariant;
};

function StaffCourseRosterContent({ variant }: StaffCourseRosterPageProps) {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("course_id") ?? "";
  const hasValidCourseId = /^[0-9]{5}$/.test(courseId);
  const courseBaseHref = getStaffCourseBaseHref(variant);
  const backLabel = variant === "instructor-workbench" ? "dashboard" : "courses";
  const backHref = hasValidCourseId
    ? `${courseBaseHref}/labs?course_id=${encodeURIComponent(courseId)}`
    : getStaffCoursesHref(variant);

  const [course, setCourse] = useState<Course | null>(null);
  const [members, setMembers] = useState<CourseMember[]>([]);
  const [courseLabs, setCourseLabs] = useState<CourseLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!courseId || !hasValidCourseId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setMessage(null);

        const [coursesResponse, membersResponse, labsResponse] = await Promise.all([
          listStaffCourses(),
          getCourseMembers(courseId),
          getCourseLabs(courseId),
        ]);

        if (cancelled) return;

        if (coursesResponse.success && coursesResponse.courses) {
          setCourse(
            coursesResponse.courses.find((entry) => entry.course_id === courseId) ?? null
          );
        } else {
          setCourse(null);
          if (coursesResponse.message) {
            setMessage({ success: false, text: coursesResponse.message });
          }
        }

        if (membersResponse.success && membersResponse.members) {
          setMembers(membersResponse.members);
        } else {
          setMembers([]);
          if (membersResponse.message) {
            setMessage({ success: false, text: membersResponse.message });
          }
        }

        if (labsResponse.success && labsResponse.labs) {
          setCourseLabs(labsResponse.labs);
        } else {
          setCourseLabs([]);
          if (labsResponse.message) {
            setMessage({ success: false, text: labsResponse.message });
          }
        }
      } catch (error) {
        if (cancelled) return;
        setMessage({
          success: false,
          text: error instanceof Error ? error.message : "Failed to load roster.",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, hasValidCourseId]);

  const activeMembers = useMemo(
    () =>
      members.filter(
        (member) => typeof member.status === "undefined" || member.status === "active"
      ),
    [members]
  );
  const studentCount = useMemo(
    () => activeMembers.filter((member) => member.role === "student").length,
    [activeMembers]
  );
  const staffCount = useMemo(
    () => activeMembers.filter((member) => member.role !== "student").length,
    [activeMembers]
  );

  if (!courseId || !hasValidCourseId) {
    return (
      <div className={`${ins.pageWrapMd} max-w-3xl`}>
        <Link href={backHref} className={ins.backLink}>
          ← Back to {backLabel}
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
          <h1 className={`${ins.h1} mt-2`}>Roster overview</h1>
          <p className={ins.subtitle}>
            {course ? `${course.code} — ${course.title}` : `Course ${courseId}`}
          </p>
          {course?.term && <p className="mt-1 text-sm text-stone-600">{course.term}</p>}
        </div>
      </header>

      {message && (
        <div className={message.success ? ins.msgOk : ins.msgErr}>{message.text}</div>
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
                {activeMembers.length}
              </p>
              <p className="mt-2 text-sm text-stone-600">Active memberships in this course.</p>
            </article>

            <article className={`${ins.card} ${ins.cardPad}`}>
              <p className={ins.labelCaps}>Students</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                {studentCount}
              </p>
              <p className="mt-2 text-sm text-stone-600">Students who can submit work.</p>
            </article>

            <article className={`${ins.card} ${ins.cardPad}`}>
              <p className={ins.labelCaps}>Staff</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                {staffCount}
              </p>
              <p className="mt-2 text-sm text-stone-600">Instructors and TAs assigned here.</p>
            </article>
          </section>

          <section className={`${ins.card} overflow-hidden`}>
            <div className="border-b border-amber-100 px-6 py-5">
              <h2 className={ins.h2Card}>Members</h2>
              <p className="mt-1 text-sm text-stone-600">
                Review enrollment and jump into a student lab review when needed.
              </p>
            </div>

            {activeMembers.length === 0 ? (
              <div className="px-6 py-8 text-sm text-stone-600">
                No members are enrolled in this course yet.
              </div>
            ) : (
              <ul className={ins.divideList}>
                {activeMembers.map((member) => (
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
                      {member.role === "student" && (
                        <CourseRosterReviewLauncher
                          courseId={courseId}
                          courseLabs={courseLabs}
                          variant={variant}
                          studentUsername={member.username}
                        />
                      )}
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

export default function StaffCourseRosterPage(props: StaffCourseRosterPageProps) {
  return (
    <Suspense
      fallback={
        <div className={`${ins.pageWrapMd} text-stone-600`}>
          <p>Loading...</p>
        </div>
      }
    >
      <StaffCourseRosterContent {...props} />
    </Suspense>
  );
}
