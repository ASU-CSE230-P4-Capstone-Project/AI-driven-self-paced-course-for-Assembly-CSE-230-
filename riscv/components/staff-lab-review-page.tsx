"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getLabSubmissions } from "@/app/api/lab_submissions/frontend";
import type { LabSubmission } from "@/app/api/lab_submissions/types";
import { listStaffCourses } from "@/app/api/staff_courses/frontend";
import { getCourseMembers } from "@/app/api/course_members/frontend";
import { getCourseLabs, type CourseLab } from "@/app/api/course_labs/frontend";
import type { Course } from "@/app/api/list_courses/types";
import type { CourseMember } from "@/app/api/course_members/types";
import { ins } from "./instructor-shell";
import LabRoot from "./lab_root";
import {
  getStaffCourseBaseHref,
  getStaffDashboardHref,
  getStaffRoleLabel,
  getStaffStudentLabsHref,
  type StaffWorkflowVariant,
} from "./staff-workflow";

type StaffLabReviewPageProps = {
  variant: StaffWorkflowVariant;
};

export default function StaffLabReviewPage({
  variant,
}: StaffLabReviewPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get("course_id") ?? "";
  const studentUsername = searchParams.get("student_username") ?? "";
  const labUid = searchParams.get("lab") ?? "";
  const requestedGradeSessionId = searchParams.get("grade_session_id") ?? "";
  const shouldOpenLab = searchParams.get("open") === "1";
  const basePath = getStaffStudentLabsHref(variant);
  const courseBaseHref = getStaffCourseBaseHref(variant);
  const roleLabel = getStaffRoleLabel(variant);

  const [courses, setCourses] = React.useState<Course[]>([]);
  const [members, setMembers] = React.useState<CourseMember[]>([]);
  const [labs, setLabs] = React.useState<CourseLab[]>([]);
  const [submissions, setSubmissions] = React.useState<LabSubmission[]>([]);
  const [coursesLoading, setCoursesLoading] = React.useState(true);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [attemptsLoading, setAttemptsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [attemptsError, setAttemptsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      setCoursesLoading(true);
      const response = await listStaffCourses();
      if (cancelled) return;

      if (!response.success || !response.courses) {
        setError(response.message ?? "Unable to load courses.");
        setCourses([]);
        setCoursesLoading(false);
        return;
      }

      setCourses(response.courses);
      setCoursesLoading(false);
    }

    void loadCourses();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!courseId) {
      setMembers([]);
      setLabs([]);
      setSubmissions([]);
      return;
    }

    let cancelled = false;

    async function loadCourseDetails() {
      setDetailsLoading(true);
      setError(null);

      const [membersResponse, labsResponse] = await Promise.all([
        getCourseMembers(courseId),
        getCourseLabs(courseId),
      ]);

      if (cancelled) return;

      if (!membersResponse.success) {
        setError(membersResponse.message ?? "Unable to load course members.");
        setMembers([]);
      } else {
        setMembers(membersResponse.members ?? []);
      }

      if (!labsResponse.success) {
        setError(labsResponse.message ?? "Unable to load course labs.");
        setLabs([]);
      } else {
        setLabs(labsResponse.labs ?? []);
      }

      setDetailsLoading(false);
    }

    void loadCourseDetails();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  React.useEffect(() => {
    if (!courseId || !studentUsername || !labUid) {
      setSubmissions([]);
      setAttemptsLoading(false);
      setAttemptsError(null);
      return;
    }

    let cancelled = false;

    async function loadAttempts() {
      setAttemptsLoading(true);
      setAttemptsError(null);

      const response = await getLabSubmissions(courseId, labUid, studentUsername);

      if (cancelled) return;

      if (!response.success) {
        setSubmissions([]);
        setAttemptsError(response.message ?? "Unable to load student attempts.");
        setAttemptsLoading(false);
        return;
      }

      setSubmissions(response.submissions ?? []);
      setAttemptsLoading(false);
    }

    void loadAttempts();

    return () => {
      cancelled = true;
    };
  }, [courseId, labUid, studentUsername]);

  const activeStudents = React.useMemo(
    () =>
      members.filter(
        (member) =>
          member.role === "student" &&
          (typeof member.status === "undefined" || member.status === "active")
      ),
    [members]
  );

  const selectedCourse = React.useMemo(
    () => courses.find((course) => course.course_id === courseId) ?? null,
    [courseId, courses]
  );

  const selectedAttemptValue = React.useMemo(
    () =>
      submissions.some(
        (submission) => submission.gradeSessionId === requestedGradeSessionId
      )
        ? requestedGradeSessionId
        : "",
    [requestedGradeSessionId, submissions]
  );
  const selectedSubmission = React.useMemo(
    () =>
      submissions.find((submission) => submission.gradeSessionId === requestedGradeSessionId) ??
      null,
    [requestedGradeSessionId, submissions]
  );
  const backHref = courseId
    ? labUid
      ? `${courseBaseHref}/submissions?course_id=${encodeURIComponent(courseId)}&lab_uid=${encodeURIComponent(labUid)}`
      : `${courseBaseHref}/labs?course_id=${encodeURIComponent(courseId)}`
    : getStaffDashboardHref(variant);
  const defaultBackLabel = "Back to dashboard";
  const backLabel = courseId
    ? labUid
      ? "Back to submissions"
      : "Back to course labs"
    : defaultBackLabel;

  const updateParams = React.useCallback(
    (
      nextValues: {
        course_id?: string;
        student_username?: string;
        lab?: string;
        grade_session_id?: string;
      },
      options?: { open?: boolean }
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      if (typeof nextValues.course_id !== "undefined") {
        if (nextValues.course_id) params.set("course_id", nextValues.course_id);
        else params.delete("course_id");
      }

      if (typeof nextValues.student_username !== "undefined") {
        if (nextValues.student_username) {
          params.set("student_username", nextValues.student_username);
        } else {
          params.delete("student_username");
        }
      }

      if (typeof nextValues.lab !== "undefined") {
        if (nextValues.lab) params.set("lab", nextValues.lab);
        else params.delete("lab");
      }

      if (typeof nextValues.grade_session_id !== "undefined") {
        if (nextValues.grade_session_id) {
          params.set("grade_session_id", nextValues.grade_session_id);
        } else {
          params.delete("grade_session_id");
        }
      } else {
        params.delete("grade_session_id");
      }

      if (options?.open) params.set("open", "1");
      else params.delete("open");

      const query = params.toString();
      router.replace(query ? `${basePath}?${query}` : basePath);
    },
    [basePath, router, searchParams]
  );

  if (shouldOpenLab && courseId && studentUsername && labUid) {
    return <LabRoot />;
  }

  return (
    <div className={ins.pageWrapWide}>
      <Link href={backHref} className={ins.backLink}>
        ← {backLabel}
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className={ins.kicker}>
            {roleLabel}
          </p>
          <h1 className={`${ins.h1} mt-2`}>Student lab review</h1>
          <p className={ins.subtitle}>
            Choose an assigned course, student, and lab to open the reused lab workspace and
            inspect submissions without touching course administration.
          </p>
        </div>
      </header>

      <section className={`${ins.card} ${ins.cardPad}`}>
        {error && <div className={ins.msgErr}>{error}</div>}

        <div className="mt-0 grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
            Course
            <select
              value={courseId}
              onChange={(event) =>
                updateParams({
                  course_id: event.target.value,
                  student_username: "",
                  lab: "",
                  grade_session_id: "",
                })
              }
              className={ins.select}
              disabled={coursesLoading}
            >
              <option value="">Select a course</option>
              {courses.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
            Student
            <select
              value={studentUsername}
              onChange={(event) =>
                updateParams({
                  student_username: event.target.value,
                  lab: "",
                  grade_session_id: "",
                })
              }
              className={ins.select}
              disabled={!courseId || detailsLoading}
            >
              <option value="">Select a student</option>
              {activeStudents.map((student) => (
                <option key={student.username} value={student.username}>
                  {student.username}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
            Lab
            <select
              value={labUid}
              onChange={(event) =>
                updateParams({ lab: event.target.value, grade_session_id: "" })
              }
              className={ins.select}
              disabled={!courseId || !studentUsername || detailsLoading}
            >
              <option value="">Select a lab</option>
              {labs.map((lab) => (
                <option key={lab.lab_uid} value={lab.lab_uid}>
                  {lab.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
            Attempt
            <select
              value={selectedAttemptValue}
              onChange={(event) =>
                updateParams({ grade_session_id: event.target.value })
              }
              className={ins.select}
              disabled={
                !courseId ||
                !studentUsername ||
                !labUid ||
                attemptsLoading ||
                submissions.length === 0
              }
            >
              <option value="">--</option>
              {submissions.map((submission, index) => (
                <option
                  key={submission.gradeSessionId}
                  value={submission.gradeSessionId}
                >
                  {`Attempt ${submissions.length - index} - ${new Date(
                    submission.submittedAt
                  ).toLocaleString()} - ${submission.grade.toFixed(2)}%`}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() =>
              updateParams(
                {
                  course_id: courseId,
                  student_username: studentUsername,
                  lab: labUid,
                  grade_session_id: selectedAttemptValue,
                },
                { open: true }
              )
            }
            className={ins.btnPrimary}
            disabled={
              !courseId ||
              !studentUsername ||
              !labUid ||
              attemptsLoading ||
              !selectedAttemptValue
            }
          >
            Go
          </button>
        </div>

        {!courseId || !studentUsername || !labUid ? null : attemptsLoading ? (
          <div className={`${ins.cardFlat} mt-6 px-4 py-3 text-sm text-stone-700`}>
            Loading student attempts...
          </div>
        ) : attemptsError ? (
          <div className={`${ins.msgErr} mt-6`}>{attemptsError}</div>
        ) : submissions.length === 0 ? (
          <div className={`${ins.cardFlat} mt-6 px-4 py-3 text-sm text-stone-500`}>
            No graded attempts are available for this student and lab.
          </div>
        ) : selectedSubmission ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm shadow-amber-950/10">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className={ins.h2Card}>Selected attempt preview</h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                Grade {selectedSubmission.grade.toFixed(2)}%
              </span>
              <span className="text-sm text-stone-700">
                {selectedSubmission.passedTests}/{selectedSubmission.totalTests} tests passed
              </span>
              <span className="text-sm text-stone-600">
                {new Date(selectedSubmission.submittedAt).toLocaleString()}
              </span>
            </div>
            {selectedSubmission.errorMessage ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {selectedSubmission.errorMessage}
              </div>
            ) : null}
            <pre className="mt-4 max-h-[24rem] overflow-auto rounded-2xl bg-stone-950 p-4 text-sm text-stone-200">
              {selectedSubmission.submittedCode}
            </pre>
          </div>
        ) : (
          <div className={`${ins.cardFlat} mt-6 px-4 py-3 text-sm text-stone-700`}>
            The attempt menu starts on <span className="font-semibold text-stone-900">--</span>. Open it and choose a graded attempt to preview and review.
          </div>
        )}

        <div className={`${ins.cardFlat} mt-6 px-4 py-3 text-sm text-stone-700`}>
          {coursesLoading
            ? "Loading courses..."
            : detailsLoading
              ? "Loading students and labs for the selected course..."
              : selectedCourse
                ? `Selected course: ${selectedCourse.code} - ${selectedCourse.title}`
                : "Start by selecting a course."}
        </div>
      </section>
    </div>
  );
}
