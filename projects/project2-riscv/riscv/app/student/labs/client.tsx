'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/sidebar';
import { getStudentCourseLabs } from '@/app/api/student_course_labs/frontend';
import type { StudentCourse } from '@/app/api/student_courses/types';
import type { StudentCourseLab } from '@/app/api/student_course_labs/types';

type StudentLabsClientProps = {
  courses: StudentCourse[];
  labs: StudentCourseLab[];
  selectedCourseId: string;
  coursesError: string | null;
  labsError: string | null;
};

export default function StudentLabsClient({
  courses,
  labs,
  selectedCourseId,
  coursesError,
  labsError,
}: StudentLabsClientProps) {
  const router = useRouter();
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const warmedCoursesRef = useRef<Set<string>>(new Set());
  const warmedWorkspaceRef = useRef(false);
  const selectedCourse =
    courses.find((course) => course.course_id === selectedCourseId) ?? null;

  const handleOpenProjects = useCallback(() => {
    router.push('/student/projects');
  }, [router]);

  const prefetchRoute = useCallback(
    (href: string) => {
      if (prefetchedRoutesRef.current.has(href)) return;
      prefetchedRoutesRef.current.add(href);
      router.prefetch(href);
    },
    [router]
  );

  const prefetchLabRoutes = useCallback(
    (courseId: string, nextLabs: StudentCourseLab[]) => {
      for (const lab of nextLabs) {
        prefetchRoute(
          `/student/labs/${encodeURIComponent(lab.uid)}?course_id=${encodeURIComponent(courseId)}`
        );
      }
    },
    [prefetchRoute]
  );

  useEffect(() => {
    for (const course of courses) {
      prefetchRoute(`/student/labs?course_id=${encodeURIComponent(course.course_id)}`);
    }
  }, [courses, prefetchRoute]);

  useEffect(() => {
    if (warmedWorkspaceRef.current) return;
    warmedWorkspaceRef.current = true;

    void Promise.allSettled([
      import('@/components/lab_root'),
      import('@/components/code-editor'),
      import('md-editor-rt'),
    ]);
  }, []);

  useEffect(() => {
    if (selectedCourse && labs.length > 0) {
      warmedCoursesRef.current.add(selectedCourse.course_id);
      prefetchLabRoutes(selectedCourse.course_id, labs);
    }
  }, [labs, prefetchLabRoutes, selectedCourse]);

  useEffect(() => {
    if (courses.length === 0) return;

    let cancelled = false;
    const seedLabsByCourse = new Map<string, StudentCourseLab[]>();
    if (selectedCourse && labs.length > 0) {
      seedLabsByCourse.set(selectedCourse.course_id, labs);
    }

    const warmLabs = async () => {
      await Promise.allSettled(
        courses.map(async (course) => {
          if (cancelled || warmedCoursesRef.current.has(course.course_id)) {
            return;
          }

          const seededLabs = seedLabsByCourse.get(course.course_id);
          if (seededLabs) {
            warmedCoursesRef.current.add(course.course_id);
            prefetchLabRoutes(course.course_id, seededLabs);
            return;
          }

          const response = await getStudentCourseLabs(course.course_id);
          if (cancelled || !response.success || !Array.isArray(response.labs)) {
            return;
          }

          warmedCoursesRef.current.add(course.course_id);
          prefetchLabRoutes(course.course_id, response.labs);
        })
      );
    };

    void warmLabs();

    return () => {
      cancelled = true;
    };
  }, [courses, labs, prefetchLabRoutes, selectedCourse]);

  return (
    <div className="min-h-screen bg-[rgb(82,82,82)] text-zinc-100 flex">
      <Sidebar
        initialOpen={false}
        onOpenProjects={handleOpenProjects}
      />
      <main className="flex-1 relative px-4 pt-16 sm:px-6 md:pl-23 md:pt-0">
        <div className="max-w-4xl mx-auto pt-8">
          <div className="flex items-center mb-6">
            <h1 className="text-3xl font-bold">
              {selectedCourse ? 'Choose a Lab' : 'Choose a Course'}
            </h1>
          </div>

          {coursesError ? (
            <div
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
              role="alert"
            >
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{coursesError}</span>
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-100 px-5 py-4 text-amber-950">
              <h2 className="text-lg font-semibold">Course enrollment required</h2>
              <p className="mt-2 text-sm">
                You are not enrolled in any active student course yet. Contact your
                instructor to be added before accessing labs.
              </p>
            </div>
          ) : !selectedCourse ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {courses.map((course) => (
                  <li key={course.course_id}>
                    <Link
                      href={`/student/labs?course_id=${encodeURIComponent(course.course_id)}`}
                      className="block hover:bg-gray-50"
                    >
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-medium text-indigo-600 truncate">
                              {course.code}
                            </p>
                            <p className="mt-1 text-sm text-gray-700">{course.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                              Course ID {course.course_id}
                              {course.term ? ` • ${course.term}` : ''}
                            </p>
                          </div>
                          <div className="ml-2 flex-shrink-0 flex">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                              Select
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : labsError ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => router.push('/student/labs')}
                className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
              >
                ← Back to Courses
              </button>
              <div
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
                role="alert"
              >
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{labsError}</span>
              </div>
            </div>
          ) : labs.length === 0 ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => router.push('/student/labs')}
                className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
              >
                ← Back to Courses
              </button>
              <div className="rounded-lg border border-slate-600 bg-slate-900/40 px-5 py-4">
                <h2 className="text-lg font-semibold">{selectedCourse.code}</h2>
                <p className="mt-1 text-sm text-zinc-300">{selectedCourse.title}</p>
                <p className="mt-4 text-sm text-zinc-300">
                  No labs are assigned to this course yet.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => router.push('/student/labs')}
                className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
              >
                ← Back to Courses
              </button>
              <div className="rounded-lg border border-slate-600 bg-slate-900/40 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                  Selected Course
                </p>
                <h2 className="mt-2 text-xl font-semibold">{selectedCourse.code}</h2>
                <p className="mt-1 text-sm text-zinc-300">{selectedCourse.title}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                  Course ID {selectedCourse.course_id}
                  {selectedCourse.term ? ` • ${selectedCourse.term}` : ''}
                </p>
              </div>
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {labs.map((lab) => (
                    <li key={lab.uid}>
                      <Link
                        href={`/student/labs/${encodeURIComponent(lab.uid)}?course_id=${encodeURIComponent(selectedCourse.course_id)}`}
                        className="block hover:bg-gray-50"
                      >
                        <div className="px-4 py-4 sm:px-6">
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-medium text-indigo-600 truncate">
                              {lab.title}
                            </p>
                            <div className="ml-2 flex-shrink-0 flex">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                Open
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
