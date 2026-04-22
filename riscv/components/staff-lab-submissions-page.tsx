'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getCourseLabSubmissionsOverview } from '@/app/api/course_lab_submissions_overview/frontend';
import { listStaffCourses } from '@/app/api/staff_courses/frontend';
import type { Course } from '@/app/api/list_courses/types';
import type { LabSubmission } from '@/app/api/lab_submissions/types';
import type { StudentSubmissionOverview } from '@/app/api/course_lab_submissions_overview/types';
import { ins } from '@/components/instructor-shell';
import {
  getStaffCourseBaseHref,
  getStaffCoursesHref,
  getStaffStudentLabsHref,
  type StaffWorkflowVariant,
} from '@/components/staff-workflow';

type StaffLabSubmissionsPageProps = {
  variant: StaffWorkflowVariant;
};

export default function StaffLabSubmissionsPage({
  variant,
}: StaffLabSubmissionsPageProps) {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('course_id') ?? '';
  const labUid = searchParams.get('lab_uid') ?? '';
  const courseBaseHref = getStaffCourseBaseHref(variant);
  const backLabel = variant === 'instructor-workbench' ? 'dashboard' : 'courses';
  const [course, setCourse] = React.useState<Course | null>(null);
  const [labTitle, setLabTitle] = React.useState('');
  const [students, setStudents] = React.useState<StudentSubmissionOverview[]>([]);
  const [averageHighestPercent, setAverageHighestPercent] = React.useState<number | null>(null);
  const [gradedStudentCount, setGradedStudentCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = React.useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = React.useState<LabSubmission | null>(null);
  const backHref = `${courseBaseHref}/labs?course_id=${encodeURIComponent(courseId)}`;
  const reviewHrefBase = getStaffStudentLabsHref(variant);
  const csvHref = `/api/course_lab_roster_grades_csv?course_id=${encodeURIComponent(courseId)}&lab_uid=${encodeURIComponent(labUid)}`;

  const formatPercent = React.useCallback((value: number | null) => {
    if (value === null) {
      return '—';
    }

    return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
  }, []);

  React.useEffect(() => {
    if (!courseId || !labUid) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [coursesResponse, overviewResponse] = await Promise.all([
        listStaffCourses(),
        getCourseLabSubmissionsOverview(courseId, labUid),
      ]);

      if (cancelled) return;

      if (coursesResponse.success && coursesResponse.courses) {
        setCourse(
          coursesResponse.courses.find((entry) => entry.course_id === courseId) ?? null
        );
      }

      if (!overviewResponse.success) {
        setError(overviewResponse.message ?? 'Unable to load lab submissions.');
        setStudents([]);
        setLabTitle('');
        setAverageHighestPercent(null);
        setGradedStudentCount(0);
        setSelectedStudent(null);
        setSelectedSubmission(null);
        setLoading(false);
        return;
      }

      const nextStudents = overviewResponse.students ?? [];
      setStudents(nextStudents);
      setLabTitle(overviewResponse.labTitle ?? '');
      setAverageHighestPercent(overviewResponse.averageHighestPercent ?? null);
      setGradedStudentCount(overviewResponse.gradedStudentCount ?? 0);
      setSelectedStudent(nextStudents[0]?.username ?? null);
      setSelectedSubmission(nextStudents[0]?.submissions[0] ?? null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [courseId, labUid]);

  const openSubmission = React.useCallback(
    (studentUsername: string, submission: LabSubmission) => {
      setSelectedStudent(studentUsername);
      setSelectedSubmission(submission);
    },
    []
  );

  if (!courseId || !labUid) {
    return (
      <div className={`${ins.pageWrapMd} max-w-3xl`}>
        <Link href={getStaffCoursesHref(variant)} className={ins.backLink}>
          ← Back to {backLabel}
        </Link>
        <div className={`${ins.card} ${ins.cardPad} mt-6`}>
          <p className="text-sm text-stone-600">Missing course or lab selection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={ins.pageWrapWide}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href={backHref} className={ins.backLink}>
            ← Back to course labs
          </Link>
          <p className={`${ins.kicker} mt-4`}>Lab Submissions</p>
          <h1 className={`${ins.h1} mt-2`}>Recent student submissions</h1>
          {course && (
            <p className={ins.subtitle}>
              {course.code} - {course.title}
            </p>
          )}
          {labTitle && <p className="mt-1 text-sm text-stone-600">Lab: {labTitle}</p>}
        </div>
        <a href={csvHref} className={ins.btnSecondary}>
          Download grades CSV
        </a>
      </header>

      {loading ? (
        <div className={`${ins.card} ${ins.cardPad} flex flex-col items-center py-12`}>
          <div className={ins.spinner} />
          <p className="mt-4 text-sm text-stone-600">Loading submissions...</p>
        </div>
      ) : error ? (
        <div className={ins.msgErr}>{error}</div>
      ) : (
        <>
          <section className={`${ins.card} ${ins.cardPad}`}>
            <p className={ins.labelCaps}>Average score</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <p className="text-3xl font-bold tracking-tight text-stone-900">
                {formatPercent(averageHighestPercent)}
              </p>
              <p className="pb-1 text-sm text-stone-600">
                {gradedStudentCount > 0
                  ? `Across ${gradedStudentCount} student${gradedStudentCount === 1 ? '' : 's'} with graded attempts`
                  : 'No graded attempts yet for this lab'}
              </p>
            </div>
            <p className="mt-2 text-sm text-stone-600">
              The student table shows each person&apos;s highest graded percent for this lab.
            </p>
          </section>

          <section className={`${ins.card} overflow-hidden`}>
            <div className="grid grid-cols-[minmax(12rem,1fr)_8rem_10rem_minmax(22rem,2fr)] gap-4 border-b border-amber-100 bg-orange-50/70 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">
              <span>Student</span>
              <span>Highest</span>
              <span>Total</span>
              <span>Recent submissions</span>
            </div>
            {students.length === 0 ? (
              <div className="px-5 py-6 text-sm text-stone-600">
                No active students are enrolled in this course.
              </div>
            ) : (
              <div className="divide-y divide-amber-100 bg-white">
                {students.map((student) => (
                  <div
                    key={student.username}
                    className="grid grid-cols-[minmax(12rem,1fr)_8rem_10rem_minmax(22rem,2fr)] items-center gap-4 px-5 py-4"
                  >
                    <div>
                      <div className="font-semibold text-stone-900">{student.username}</div>
                      <Link
                        href={`${reviewHrefBase}?course_id=${encodeURIComponent(courseId)}&student_username=${encodeURIComponent(student.username)}&lab=${encodeURIComponent(labUid)}`}
                        className="mt-1 inline-flex text-sm font-medium text-amber-800 hover:text-amber-950"
                      >
                        Open lab review
                      </Link>
                    </div>
                    <div className="text-sm font-medium text-stone-800">
                      {formatPercent(student.highestPercent)}
                    </div>
                    <div className="text-sm text-stone-600">{student.totalSubmissions}</div>
                    <div className="flex flex-wrap gap-2">
                      {student.submissions.length === 0 ? (
                        <span className="text-sm text-stone-500">No submissions yet</span>
                      ) : (
                        <>
                          {student.submissions.map((submission, index) => {
                            const isActive =
                              selectedStudent === student.username &&
                              selectedSubmission?.gradeSessionId === submission.gradeSessionId;
                            return (
                              <button
                                key={submission.gradeSessionId}
                                type="button"
                                onClick={() => openSubmission(student.username, submission)}
                                className={
                                  isActive
                                    ? ins.btnPrimary
                                    : ins.btnSecondary
                                }
                              >
                                Attempt {index + 1}
                              </button>
                            );
                          })}
                          {student.totalSubmissions > student.submissions.length && (
                            <span className="self-center text-xs text-stone-500">
                              Showing latest {student.submissions.length} of {student.totalSubmissions}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`${ins.card} ${ins.cardPad}`}>
            {selectedSubmission && selectedStudent ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className={ins.h2Card}>{selectedStudent} submission</h2>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    Grade {selectedSubmission.grade.toFixed(2)}%
                  </span>
                  <span className="text-sm text-stone-800">
                    {selectedSubmission.passedTests}/{selectedSubmission.totalTests} tests passed
                  </span>
                  <span className="text-sm text-stone-600">
                    {new Date(selectedSubmission.submittedAt).toLocaleString()}
                  </span>
                </div>
                {selectedSubmission.errorMessage && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {selectedSubmission.errorMessage}
                  </div>
                )}
                <pre className="mt-4 max-h-[32rem] overflow-auto rounded-2xl bg-stone-950 p-4 text-sm text-stone-200">
                  {selectedSubmission.submittedCode}
                </pre>
              </>
            ) : (
              <div className="text-sm text-stone-600">
                Choose a submission button from a student row to inspect the code.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
