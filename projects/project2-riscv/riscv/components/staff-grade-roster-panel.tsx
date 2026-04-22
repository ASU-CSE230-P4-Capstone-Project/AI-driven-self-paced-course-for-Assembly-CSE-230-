'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Course } from '@/app/api/list_courses/types';
import type { CourseLab } from '@/app/api/course_labs/frontend';
import type { CourseLabRosterGradeEntry } from '@/app/api/course_lab_roster_grades/types';
import { getCourseLabs } from '@/app/api/course_labs/frontend';
import { getCourseLabRosterGrades } from '@/app/api/course_lab_roster_grades/frontend';
import { listStaffCourses } from '@/app/api/staff_courses/frontend';
import { ins } from '@/components/instructor-shell';

type StaffGradeRosterPanelProps = {
  portal: 'instructor' | 'ta';
  compact?: boolean;
  fixedCourse?: Course | null;
  triggerLabel?: string;
};

function formatGrade(grade: number): string {
  return `${Number.isInteger(grade) ? grade.toFixed(0) : grade.toFixed(2)}%`;
}

export default function StaffGradeRosterPanel({
  portal,
  compact = false,
  fixedCourse = null,
  triggerLabel,
}: StaffGradeRosterPanelProps) {
  const isInstructor = portal === 'instructor';
  const [isOpen, setIsOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [labs, setLabs] = useState<CourseLab[]>([]);
  const [rows, setRows] = useState<CourseLabRosterGradeEntry[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(fixedCourse?.course_id ?? '');
  const [selectedLabUid, setSelectedLabUid] = useState('');
  const [labTitle, setLabTitle] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingLabs, setLoadingLabs] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    setSelectedCourseId(fixedCourse?.course_id ?? '');
  }, [fixedCourse?.course_id]);

  useEffect(() => {
    if (!isOpen) return;
    if (fixedCourse) {
      setCourses([fixedCourse]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingCourses(true);
        const response = await listStaffCourses();
        if (cancelled) return;

        if (!response.success) {
          setCourses([]);
          setSelectedCourseId('');
          setMessage({
            success: false,
            text: response.message ?? 'Failed to load your courses.',
          });
          return;
        }

        const nextCourses = response.courses ?? [];
        setCourses(nextCourses);
        setSelectedCourseId((current) =>
          current && nextCourses.some((course) => course.course_id === current)
            ? current
            : (nextCourses[0]?.course_id ?? '')
        );
        setMessage(null);
      } catch (error) {
        if (cancelled) return;
        setCourses([]);
        setSelectedCourseId('');
        setMessage({
          success: false,
          text: error instanceof Error ? error.message : 'Failed to load your courses.',
        });
      } finally {
        if (!cancelled) {
          setLoadingCourses(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fixedCourse, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (!selectedCourseId) {
      setLabs([]);
      setSelectedLabUid('');
      setRows([]);
      setLabTitle('');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingLabs(true);
        const response = await getCourseLabs(selectedCourseId);
        if (cancelled) return;

        if (!response.success) {
          setLabs([]);
          setSelectedLabUid('');
          setRows([]);
          setLabTitle('');
          setMessage({
            success: false,
            text: response.message ?? 'Failed to load labs for this course.',
          });
          return;
        }

        const nextLabs = response.labs ?? [];
        setLabs(nextLabs);
        setSelectedLabUid((current) =>
          current && nextLabs.some((lab) => lab.lab_uid === current)
            ? current
            : (nextLabs[0]?.lab_uid ?? '')
        );
        setMessage(null);
      } catch (error) {
        if (cancelled) return;
        setLabs([]);
        setSelectedLabUid('');
        setRows([]);
        setLabTitle('');
        setMessage({
          success: false,
          text: error instanceof Error ? error.message : 'Failed to load labs for this course.',
        });
      } finally {
        if (!cancelled) {
          setLoadingLabs(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedCourseId]);

  useEffect(() => {
    if (!isOpen) return;

    if (!selectedCourseId || !selectedLabUid) {
      setRows([]);
      setLabTitle('');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingRows(true);
        const response = await getCourseLabRosterGrades(selectedCourseId, selectedLabUid);
        if (cancelled) return;

        if (!response.success) {
          setRows([]);
          setLabTitle('');
          setMessage({
            success: false,
            text: response.message ?? 'Failed to load the grade roster.',
          });
          return;
        }

        setRows(response.members ?? []);
        setLabTitle(response.labTitle ?? '');
        setMessage(null);
      } catch (error) {
        if (cancelled) return;
        setRows([]);
        setLabTitle('');
        setMessage({
          success: false,
          text: error instanceof Error ? error.message : 'Failed to load the grade roster.',
        });
      } finally {
        if (!cancelled) {
          setLoadingRows(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedCourseId, selectedLabUid]);

  const selectedCourse = useMemo(
    () =>
      fixedCourse && fixedCourse.course_id === selectedCourseId
        ? fixedCourse
        : (courses.find((course) => course.course_id === selectedCourseId) ?? null),
    [courses, fixedCourse, selectedCourseId]
  );

  const csvHref =
    selectedCourseId && selectedLabUid
      ? `/api/course_lab_roster_grades_csv?course_id=${encodeURIComponent(selectedCourseId)}&lab_uid=${encodeURIComponent(selectedLabUid)}`
      : '';

  const introText = isInstructor
    ? "Open this when you need a course and lab roster with each student's highest grade."
    : 'Open this when you need a course and lab roster plus a CSV export for grading review.';
  const fieldPrefix = `${portal}-grade-${fixedCourse?.course_id ?? 'all'}`;
  const resolvedTriggerLabel =
    triggerLabel ??
    (compact ? 'Course lab grade export' : isOpen ? 'Hide course lab grade export' : 'Course lab grade export');
  const triggerClassName = compact
    ? `${ins.btnNeutral} px-3 py-2 text-xs font-semibold`
    : isOpen
      ? ins.btnSecondary
      : ins.btnPrimary;

  if (compact) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={triggerClassName}
        >
          {isOpen ? `Hide ${resolvedTriggerLabel.toLowerCase()}` : resolvedTriggerLabel}
        </button>

        {!isOpen ? null : (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-orange-50/55 p-4 shadow-sm">
            {message && (
              <div className={`${message.success ? ins.msgOk : ins.msgErr}`}>
                {message.text}
              </div>
            )}

            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className={ins.labelCaps}>Grade Export</p>
                <h4 className="mt-1 text-base font-semibold text-stone-900">
                  {selectedCourse?.code ?? 'Course'} lab roster export
                </h4>
                <p className="mt-1 text-sm text-stone-600">
                  Select a lab and download the grade CSV with score, ASUID, name, lab, and timestamp details.
                </p>
              </div>
              {csvHref ? (
                <a href={csvHref} className={`${ins.btnPrimary} px-3 py-2 text-xs`}>
                  Download CSV
                </a>
              ) : (
                <span className={`${ins.btnDisabled} px-3 py-2 text-xs`}>Download CSV</span>
              )}
            </div>

            <div
              className={`mt-4 grid gap-4 ${
                fixedCourse
                  ? 'md:grid-cols-[minmax(0,1fr)_auto]'
                  : 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'
              }`}
            >
              {!fixedCourse && (
                <div>
                  <label htmlFor={`${fieldPrefix}-course`} className={ins.label}>
                    Course
                  </label>
                  <select
                    id={`${fieldPrefix}-course`}
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                    disabled={loadingCourses || courses.length === 0}
                    className={ins.select}
                  >
                    {courses.length === 0 ? (
                      <option value="">No staff courses</option>
                    ) : (
                      courses.map((course) => (
                        <option key={course.course_id} value={course.course_id}>
                          {course.code} — {course.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor={`${fieldPrefix}-lab`} className={ins.label}>
                  Lab
                </label>
                <select
                  id={`${fieldPrefix}-lab`}
                  value={selectedLabUid}
                  onChange={(event) => setSelectedLabUid(event.target.value)}
                  disabled={loadingLabs || labs.length === 0}
                  className={ins.select}
                >
                  {labs.length === 0 ? (
                    <option value="">
                      {selectedCourseId ? 'No labs assigned' : 'Select a course first'}
                    </option>
                  ) : (
                    labs.map((lab) => (
                      <option key={lab.lab_uid} value={lab.lab_uid}>
                        {lab.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="md:min-w-[10rem]">
                <p className={ins.labelCaps}>Students listed</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
                  {rows.length}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {labTitle || 'Select a lab to load the roster'}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-amber-100">
              <div className="grid grid-cols-[9rem_minmax(10rem,1fr)_minmax(10rem,1fr)_7rem] gap-3 border-b border-amber-100 bg-white/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                <span>ASU ID</span>
                <span>Name</span>
                <span>Username</span>
                <span>Grade</span>
              </div>

              {loadingRows ? (
                <div className="px-4 py-5 text-sm text-stone-600">Loading roster grades...</div>
              ) : rows.length === 0 ? (
                <div className="px-4 py-5 text-sm text-stone-600">
                  {selectedCourseId && selectedLabUid
                    ? 'No student roster entries found for this course.'
                    : 'Select a course and lab to load roster grades.'}
                </div>
              ) : (
                <div className="divide-y divide-amber-100 bg-white">
                  {rows.map((row) => (
                    <div
                      key={row.username}
                      className="grid grid-cols-[9rem_minmax(10rem,1fr)_minmax(10rem,1fr)_7rem] gap-3 px-4 py-3 text-sm text-stone-800"
                    >
                      <span className="font-medium text-stone-900">{row.asuid}</span>
                      <span>{row.name}</span>
                      <span className="text-stone-600">{row.username}</span>
                      <span className="font-semibold text-stone-900">{formatGrade(row.grade)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className={`${ins.card} ${ins.cardPad}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className={ins.kicker}>Grade Roster</p>
          <p className={`${ins.subtitleMuted} mt-2 max-w-2xl`}>{introText}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={triggerClassName}
        >
          {resolvedTriggerLabel}
        </button>
      </div>

      {!isOpen ? (
        <p className="mt-5 text-sm text-stone-600">
          The dashboard stays lighter until you open the export tool.
        </p>
      ) : (
        <>
          {message && (
            <div className={`mt-5 ${message.success ? ins.msgOk : ins.msgErr}`}>
              {message.text}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className={ins.h2}>Course lab grade export</h2>
              <p className={`${ins.subtitleMuted} mt-2 max-w-2xl`}>
                Download the selected course lab grade CSV with score, ASUID, name, lab, and timestamp details.
              </p>
            </div>
            {csvHref ? (
              <a href={csvHref} className={ins.btnPrimary}>
                Download roster CSV
              </a>
            ) : (
              <span className={ins.btnDisabled}>Download roster CSV</span>
            )}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div>
              <label htmlFor={`${fieldPrefix}-course`} className={ins.label}>
                Course
              </label>
              <select
                id={`${fieldPrefix}-course`}
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                disabled={loadingCourses || courses.length === 0}
                className={ins.select}
              >
                {courses.length === 0 ? (
                  <option value="">No staff courses</option>
                ) : (
                  courses.map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {course.code} — {course.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label htmlFor={`${fieldPrefix}-lab`} className={ins.label}>
                Lab
              </label>
              <select
                id={`${fieldPrefix}-lab`}
                value={selectedLabUid}
                onChange={(event) => setSelectedLabUid(event.target.value)}
                disabled={loadingLabs || labs.length === 0}
                className={ins.select}
              >
                {labs.length === 0 ? (
                  <option value="">
                    {selectedCourseId ? 'No labs assigned' : 'Select a course first'}
                  </option>
                ) : (
                  labs.map((lab) => (
                    <option key={lab.lab_uid} value={lab.lab_uid}>
                      {lab.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="lg:min-w-[12rem]">
              <p className={ins.labelCaps}>Students listed</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">{rows.length}</p>
              <p className="mt-1 text-sm text-stone-600">
                {labTitle || 'Select a lab to load the roster'}
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-amber-100">
            <div className="grid grid-cols-[10rem_minmax(12rem,1fr)_minmax(12rem,1fr)_8rem] gap-4 border-b border-amber-100 bg-orange-50/70 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">
              <span>ASU ID</span>
              <span>Name</span>
              <span>Username</span>
              <span>Highest Grade</span>
            </div>

            {loadingRows ? (
              <div className="px-5 py-6 text-sm text-stone-600">Loading roster grades...</div>
            ) : rows.length === 0 ? (
              <div className="px-5 py-6 text-sm text-stone-600">
                {selectedCourseId && selectedLabUid
                  ? 'No student roster entries found for this course.'
                  : 'Select a course and lab to load roster grades.'}
              </div>
            ) : (
              <div className="divide-y divide-amber-100 bg-white">
                {rows.map((row) => (
                  <div
                    key={row.username}
                    className="grid grid-cols-[10rem_minmax(12rem,1fr)_minmax(12rem,1fr)_8rem] gap-4 px-5 py-4 text-sm text-stone-800"
                  >
                    <span className="font-medium text-stone-900">{row.asuid}</span>
                    <span>{row.name}</span>
                    <span className="text-stone-600">{row.username}</span>
                    <span className="font-semibold text-stone-900">{formatGrade(row.grade)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedCourse && (
            <p className="mt-4 text-sm text-stone-600">
              Showing active student roster for {selectedCourse.code}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
