"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CourseLab } from "@/app/api/course_labs/frontend";
import { getCourseLabs } from "@/app/api/course_labs/frontend";
import type { LabGradesSummaryResponse } from "@/app/api/lab_grades_summary/types";
import { ins } from "@/components/instructor-shell";
import {
  getStaffCourseBaseHref,
  getStaffCoursesHref,
  type StaffWorkflowVariant,
} from "@/components/staff-workflow";

type StaffCourseGradesPageProps = {
  variant: StaffWorkflowVariant;
};

function StaffCourseGradesContent({ variant }: StaffCourseGradesPageProps) {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("course_id") ?? "";
  const labUidFromQuery = searchParams.get("lab_uid") ?? "";
  const hasValidCourseId = /^[0-9]{5}$/.test(courseId);
  const courseBaseHref = getStaffCourseBaseHref(variant);
  const backLabel = variant === "instructor-workbench" ? "dashboard" : "courses";
  const backHref = hasValidCourseId
    ? `${courseBaseHref}/labs?course_id=${encodeURIComponent(courseId)}`
    : getStaffCoursesHref(variant);

  const [courseLabs, setCourseLabs] = useState<CourseLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(
    null
  );
  const [selectedLabUid, setSelectedLabUid] = useState("");
  const [gradesSummary, setGradesSummary] = useState<LabGradesSummaryResponse | null>(
    null
  );
  const [gradesLoading, setGradesLoading] = useState(false);
  const csvHref =
    selectedLabUid && hasValidCourseId
      ? `/api/course_lab_roster_grades_csv?course_id=${encodeURIComponent(courseId)}&lab_uid=${encodeURIComponent(selectedLabUid)}`
      : '';

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

        const labsResponse = await getCourseLabs(courseId);

        if (cancelled) return;

        const nextLabs = (labsResponse.success && labsResponse.labs
          ? labsResponse.labs
          : []) as CourseLab[];

        setCourseLabs(nextLabs);

        const defaultLab =
          nextLabs.find((lab) => lab.lab_uid === "lab0-intro-addition") ??
          nextLabs.find(
            (lab) =>
              lab.title.toLowerCase().includes("lab 0") ||
              lab.title.toLowerCase().includes("addition")
          ) ??
          nextLabs[0];

        const desiredLabUid =
          labUidFromQuery && nextLabs.some((lab) => lab.lab_uid === labUidFromQuery)
            ? labUidFromQuery
            : defaultLab?.lab_uid ?? "";

        setSelectedLabUid(desiredLabUid);
      } catch (error) {
        if (cancelled) return;
        setMessage({
          success: false,
          text: error instanceof Error ? error.message : "Failed to load grade tools.",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, hasValidCourseId, labUidFromQuery]);

  useEffect(() => {
    if (!courseId || !hasValidCourseId || !selectedLabUid) return;

    let cancelled = false;

    (async () => {
      try {
        setGradesLoading(true);
        const response = await fetch(
          `/api/lab_grades_summary?course_id=${encodeURIComponent(courseId)}&lab_uid=${encodeURIComponent(selectedLabUid)}`
        );
        const data = (await response.json()) as LabGradesSummaryResponse;

        if (cancelled) return;

        if (!response.ok || !data.success) {
          setMessage({
            success: false,
            text: data.message ?? "Failed to load grades summary.",
          });
          setGradesSummary(null);
          return;
        }

        setGradesSummary(data);
        setMessage(null);
      } catch (error) {
        if (cancelled) return;
        setMessage({
          success: false,
          text: error instanceof Error ? error.message : "Failed to load grades.",
        });
      } finally {
        if (!cancelled) setGradesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, hasValidCourseId, selectedLabUid]);

  if (!courseId || !hasValidCourseId) {
    return (
      <div className={ins.pageWrapMd}>
        <Link href={backHref} className={ins.backLink}>
          ← Back to {backLabel}
        </Link>
        <p className="mt-4 text-stone-600">Invalid course.</p>
      </div>
    );
  }

  return (
    <div className={ins.pageWrapMd}>
      <Link href={backHref} className={ins.backLink}>
        ← Back to course labs
      </Link>
      <div className="mt-4">
        <p className={ins.kicker}>Course Grades</p>
        <h1 className={`${ins.h1} mt-2`}>View all grades</h1>
        <p className={ins.subtitle}>Review best scores for the selected lab.</p>
      </div>

      {message && (
        <div className={`mt-4 ${message.success ? ins.msgOk : ins.msgErr}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className={`${ins.card} ${ins.cardPad} mt-6 flex flex-col items-center py-12`}>
          <div className={ins.spinner} />
          <p className="mt-4 text-sm text-stone-600">Loading grade tools...</p>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-[12rem] flex-1">
                <label className={ins.label}>Lab</label>
                <select
                  value={selectedLabUid}
                  onChange={(event) => setSelectedLabUid(event.target.value)}
                  className={ins.select}
                  disabled={gradesLoading}
                >
                  {courseLabs.map((lab) => (
                    <option key={lab.lab_uid} value={lab.lab_uid}>
                      {lab.title}
                    </option>
                  ))}
                </select>
              </div>

              <a
                href={csvHref || undefined}
                aria-disabled={!csvHref}
                className={!csvHref ? ins.btnDisabled : ins.btnPrimary}
              >
                Download grades CSV
              </a>
            </div>
          </div>

          <div className={`${ins.card} mt-6 overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <h2 className={ins.h2Card}>Final scores</h2>
              <div className="text-sm text-stone-600">
                {gradesLoading
                  ? "Loading..."
                  : gradesSummary
                    ? `Max score: ${gradesSummary.maxScore}`
                    : ""}
              </div>
            </div>

            <div className="p-4">
              {gradesLoading || !gradesSummary ? (
                <p className="text-stone-600">Loading grades...</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`${ins.tableHead} text-left`}>
                      <th className={`${ins.tableCell} font-semibold text-stone-900`}>Username</th>
                      <th className={`${ins.tableCell} font-semibold text-stone-900`}>Role</th>
                      <th className={`${ins.tableCell} font-semibold text-stone-900`}>Attempts Used</th>
                      <th className={`${ins.tableCell} font-semibold text-stone-900`}>Best Score</th>
                    </tr>
                  </thead>
                  <tbody className={ins.divideList}>
                    {gradesSummary.members?.map((member) => (
                      <tr key={member.username}>
                        <td className={`${ins.tableCell} font-medium text-stone-900`}>
                          {member.username}
                        </td>
                        <td className={ins.tableCell}>{member.role}</td>
                        <td className={ins.tableCell}>{member.attemptsUsed}</td>
                        <td className={`${ins.tableCell} text-stone-800`}>
                          {member.bestScore === null ? "—" : member.bestScore}
                        </td>
                      </tr>
                    ))}
                    {(!gradesSummary.members || gradesSummary.members.length === 0) && (
                      <tr>
                        <td colSpan={4} className={`${ins.tableCell} text-stone-700`}>
                          No members found for this course.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function StaffCourseGradesPage(props: StaffCourseGradesPageProps) {
  return (
    <Suspense
      fallback={
        <div className={`${ins.pageWrapMd} text-stone-600`}>
          <p>Loading...</p>
        </div>
      }
    >
      <StaffCourseGradesContent {...props} />
    </Suspense>
  );
}
