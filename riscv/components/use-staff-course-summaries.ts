"use client";

import React from "react";
import { getCourseLabs } from "@/app/api/course_labs/frontend";
import { getCourseMembers } from "@/app/api/course_members/frontend";
import { listStaffCourses } from "@/app/api/staff_courses/frontend";
import type { Course } from "@/app/api/list_courses/types";

type StaffCourseCounts = {
  studentCount: number;
  staffCount: number;
  labCount: number;
};

export type StaffCourseSummary = StaffCourseCounts & {
  course: Course;
};

function isActiveStatus(status?: string) {
  return typeof status === "undefined" || status === "active";
}

export function useStaffCourseSummaries() {
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [countsByCourseId, setCountsByCourseId] = React.useState<
    Record<string, StaffCourseCounts>
  >({});
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const coursesResponse = await listStaffCourses();
      if (!coursesResponse.success) {
        setCourses([]);
        setCountsByCourseId({});
        setMessage(coursesResponse.message ?? "Failed to load assigned courses.");
        return;
      }

      const nextCourses = coursesResponse.courses ?? [];
      setCourses(nextCourses);

      if (nextCourses.length === 0) {
        setCountsByCourseId({});
        return;
      }

      const detailResults = await Promise.all(
        nextCourses.map(async (course) => {
          const [membersResponse, labsResponse] = await Promise.all([
            getCourseMembers(course.course_id),
            getCourseLabs(course.course_id),
          ]);

          const members = membersResponse.success ? membersResponse.members ?? [] : [];
          const labs = labsResponse.success ? labsResponse.labs ?? [] : [];

          const studentCount = members.filter(
            (member) => member.role === "student" && isActiveStatus(member.status)
          ).length;
          const staffCount = members.filter(
            (member) => member.role !== "student" && isActiveStatus(member.status)
          ).length;

          return {
            courseId: course.course_id,
            counts: {
              studentCount,
              staffCount,
              labCount: labs.length,
            },
            errors: [
              ...(membersResponse.success
                ? []
                : [membersResponse.message ?? `Failed to load roster for ${course.code}.`]),
              ...(labsResponse.success
                ? []
                : [labsResponse.message ?? `Failed to load labs for ${course.code}.`]),
            ],
          };
        })
      );

      setCountsByCourseId(
        Object.fromEntries(
          detailResults.map((result) => [result.courseId, result.counts])
        )
      );

      const errors = detailResults.flatMap((result) => result.errors).filter(Boolean);
      setMessage(errors.length > 0 ? errors[0] : null);
    } catch (error) {
      setCourses([]);
      setCountsByCourseId({});
      setMessage(
        error instanceof Error ? error.message : "Failed to load assigned courses."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const summaries = React.useMemo<StaffCourseSummary[]>(
    () =>
      courses.map((course) => ({
        course,
        studentCount: countsByCourseId[course.course_id]?.studentCount ?? 0,
        staffCount: countsByCourseId[course.course_id]?.staffCount ?? 0,
        labCount: countsByCourseId[course.course_id]?.labCount ?? 0,
      })),
    [countsByCourseId, courses]
  );

  return {
    summaries,
    loading,
    message,
    reload: load,
  };
}
