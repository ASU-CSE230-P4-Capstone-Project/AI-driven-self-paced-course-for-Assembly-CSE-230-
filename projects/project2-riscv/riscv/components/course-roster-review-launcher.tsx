'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLabSubmissions } from '@/app/api/lab_submissions/frontend';
import type { LabSubmission } from '@/app/api/lab_submissions/types';
import type { CourseLab } from '@/app/api/course_labs/frontend';
import { ins } from '@/components/instructor-shell';
import {
  getStaffStudentLabsHref,
  type StaffWorkflowVariant,
} from '@/components/staff-workflow';

type CourseRosterReviewLauncherProps = {
  courseId: string;
  courseLabs: CourseLab[];
  variant: StaffWorkflowVariant;
  studentUsername: string;
};

function formatAttemptLabel(submission: LabSubmission, index: number, total: number) {
  const submittedAt = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleString()
    : 'Unknown time';
  return `Attempt ${total - index} - ${submittedAt} - ${submission.grade.toFixed(2)}%`;
}

export default function CourseRosterReviewLauncher({
  courseId,
  courseLabs,
  variant,
  studentUsername,
}: CourseRosterReviewLauncherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabUid, setSelectedLabUid] = useState('');
  const [selectedAttemptId, setSelectedAttemptId] = useState('');
  const [attempts, setAttempts] = useState<LabSubmission[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);

  const reviewBaseHref = useMemo(() => getStaffStudentLabsHref(variant), [variant]);

  useEffect(() => {
    if (!isOpen || !selectedLabUid) {
      setAttempts([]);
      setAttemptsLoading(false);
      setAttemptsError(null);
      setSelectedAttemptId('');
      return;
    }

    let cancelled = false;

    async function loadAttempts() {
      setAttemptsLoading(true);
      setAttemptsError(null);
      setSelectedAttemptId('');

      const response = await getLabSubmissions(courseId, selectedLabUid, studentUsername);

      if (cancelled) return;

      if (!response.success) {
        setAttempts([]);
        setAttemptsError(response.message ?? 'Failed to load attempts.');
        setAttemptsLoading(false);
        return;
      }

      setAttempts(response.submissions ?? []);
      setAttemptsLoading(false);
    }

    void loadAttempts();

    return () => {
      cancelled = true;
    };
  }, [courseId, isOpen, selectedLabUid, studentUsername]);

  const handleToggle = () => {
    setIsOpen((current) => !current);
    if (isOpen) {
      setSelectedLabUid('');
      setSelectedAttemptId('');
      setAttempts([]);
      setAttemptsError(null);
    }
  };

  const handleGo = () => {
    if (!selectedLabUid || !selectedAttemptId) return;

    const params = new URLSearchParams({
      course_id: courseId,
      student_username: studentUsername,
      lab: selectedLabUid,
      open: '1',
      grade_session_id: selectedAttemptId,
    });

    router.push(`${reviewBaseHref}?${params.toString()}`);
  };

  return (
    <div className="w-full lg:w-auto">
      <button
        type="button"
        onClick={handleToggle}
        className={ins.btnNeutral}
      >
        {isOpen ? 'Hide review tools' : 'Review labs'}
      </button>

      {!isOpen ? null : (
        <div className="mt-3 w-full rounded-2xl border border-amber-200 bg-orange-50/60 p-4 lg:min-w-[38rem]">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_auto] md:items-end">
            <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
              Lab
              <select
                value={selectedLabUid}
                onChange={(event) => setSelectedLabUid(event.target.value)}
                className={ins.select}
                disabled={courseLabs.length === 0}
              >
                <option value="">Select a lab</option>
                {courseLabs.map((lab) => (
                  <option key={lab.lab_uid} value={lab.lab_uid}>
                    {lab.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
              Attempt
              <select
                value={selectedAttemptId}
                onChange={(event) => setSelectedAttemptId(event.target.value)}
                className={ins.select}
                disabled={!selectedLabUid || attemptsLoading || attempts.length === 0}
              >
                <option value="">--</option>
                {attempts.map((attempt, index) => (
                  <option key={attempt.gradeSessionId} value={attempt.gradeSessionId}>
                    {formatAttemptLabel(attempt, index, attempts.length)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleGo}
              disabled={!selectedLabUid || attemptsLoading || !selectedAttemptId}
              className={ins.btnPrimary}
            >
              Go
            </button>
          </div>

          {courseLabs.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">
              No labs are assigned to this course yet.
            </p>
          ) : attemptsLoading ? (
            <p className="mt-3 text-sm text-stone-600">Loading attempts...</p>
          ) : attemptsError ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {attemptsError}
            </div>
          ) : !selectedLabUid ? (
            <p className="mt-3 text-sm text-stone-600">
              Choose a lab first, then open the attempt menu to see graded attempts.
            </p>
          ) : attempts.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">
              No graded attempts are available for this student and lab.
            </p>
          ) : (
            <p className="mt-3 text-sm text-stone-600">
              The attempt menu starts on <span className="font-medium text-stone-900">--</span>. Open it and choose a graded attempt before continuing.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
