'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { listLabs } from '@/app/api/list_labs/frontend';
import { updateLab } from '@/app/api/update_lab/frontend';
import { Lab } from '@/app/api/list_labs/types';
import { getLabCourses, syncLabCourses } from '@/app/api/lab_courses/frontend';
import { listTestCases } from '@/app/api/list_test_cases/frontend';
import { createTestCase } from '@/app/api/create_test_case/frontend';
import { deleteTestCase } from '@/app/api/delete_test_case/frontend';
import type { TestCase } from '@/app/api/create_test_case/types';
import TestCaseEditor from '@/components/TestCaseEditor';
import { ins } from '@/components/instructor-shell';
import dynamic from 'next/dynamic';

// Dynamically import the markdown editor to avoid SSR issues
const MdEditor = dynamic(
  () => import('md-editor-rt').then((mod) => mod.MdEditor),
  { ssr: false }
);

// Import the CSS for the markdown editor
import 'md-editor-rt/lib/style.css';

export default function EditLabPage() {
  const params = useParams<{ uid: string }>();
  const router = useRouter();
  const [lab, setLab] = useState<Lab | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testCasesLoading, setTestCasesLoading] = useState(false);
  const [testCasesError, setTestCasesError] = useState<string | null>(null);
  const [newTestCaseName, setNewTestCaseName] = useState('');
  const [creatingTestCase, setCreatingTestCase] = useState(false);

    // ===== Course Assignment =====
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLab = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await listLabs();
        
        if (response.success && response.labs) {
          const foundLab = response.labs.find(l => l.uid === params.uid);
          if (foundLab) {
            setLab(foundLab);
            setTitle(foundLab.title);
            setContent(foundLab.md);
          } else {
            setError('Lab not found');
          }
        } else {
          setError(response.message || 'Failed to fetch labs');
        }
      } catch (err) {
        setError('An error occurred while fetching the lab');
        console.error('Error fetching lab:', err);
      } finally {
        setLoading(false);
      }
    };

    if (params.uid) {
      fetchLab();
    }
  }, [params.uid]);

  // Fetch all courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setCoursesLoading(true);
        setCoursesError(null);

        const res = await fetch('/api/list_courses');
        const data = await res.json();

        if (data.success) {
          setCourses(data.courses);
        } else {
          setCoursesError(data.message || 'Failed to load courses');
        }
      } catch (err) {
        console.error('Error loading courses:', err);
        setCoursesError('Error loading courses');
      } finally {
        setCoursesLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Load which courses this lab is assigned to
  useEffect(() => {
    if (!params.uid) return;
    const load = async () => {
      const res = await getLabCourses(params.uid);
      if (res.success && res.course_ids) setSelectedCourses(res.course_ids);
    };
    load();
  }, [params.uid]);

  useEffect(() => {
    const fetchTestCases = async () => {
      if (!params.uid) return;
      try {
        setTestCasesLoading(true);
        setTestCasesError(null);
        const response = await listTestCases(params.uid);
        if (response.success && response.testCases) {
          setTestCases(response.testCases);
        } else {
          setTestCasesError(response.message || 'Failed to fetch test cases');
        }
      } catch (err) {
        console.error('Error fetching test cases:', err);
        setTestCasesError('An error occurred while fetching test cases');
      } finally {
        setTestCasesLoading(false);
      }
    };

    fetchTestCases();
  }, [params.uid]);

  const handleSave = async () => {
    if (!lab) return;

    try {
      setSaving(true);
      setSaveSuccess(false);
      setError(null);

      const updatedLab: Lab = {
        uid: lab.uid,
        title: title,
        md: content
      };

      const response = await updateLab(updatedLab);
      if (!response.success) {
        setError(response.message || 'Failed to update lab');
        return;
      }

      const syncRes = await syncLabCourses(lab.uid, selectedCourses);
      if (!syncRes.success) {
        setError(syncRes.message || 'Lab saved but course assignments failed to update');
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('An error occurred while saving the lab');
      console.error('Error saving lab:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.uid) return;
    if (!newTestCaseName.trim()) return;

    try {
      setCreatingTestCase(true);
      const response = await createTestCase(params.uid, newTestCaseName.trim());
      if (response.success && response.testCase) {
        setTestCases((prev) => [response.testCase!, ...prev]);
        setNewTestCaseName('');
      } else {
        setTestCasesError(response.message || 'Failed to create test case');
      }
    } catch (err) {
      console.error('Error creating test case:', err);
      setTestCasesError('An error occurred while creating test case');
    } finally {
      setCreatingTestCase(false);
    }
  };

  const handleDeleteTestCase = async (uid: string) => {
    try {
      const response = await deleteTestCase(uid);
      if (response.success) {
        setTestCases((prev) => prev.filter((tc) => tc.uid !== uid));
      } else {
        setTestCasesError(response.message || 'Failed to delete test case');
      }
    } catch (err) {
      console.error('Error deleting test case:', err);
      setTestCasesError('An error occurred while deleting test case');
    }
  };

  const toggleCourse = (courseId: string) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleUpdateTestCase = (updated: TestCase) => {
    setTestCases((prev) =>
      prev.map((tc) => (tc.uid === updated.uid ? updated : tc))
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className={`${ins.h1} mb-6`}>Edit Lab</h1>
          <div className="py-8 text-center">
            <div className={`${ins.spinner} mx-auto`} />
            <p className="mt-2 text-stone-600">Loading lab...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className={`${ins.h1} mb-6`}>Edit Lab</h1>
          <div className={ins.msgErr} role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="inline sm:inline">{error}</span>
            <button
              type="button"
              onClick={() => router.back()}
              className={`${ins.btnDangerSolid} mt-3 block`}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!lab) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className={`${ins.h1} mb-6`}>Edit Lab</h1>
          <div className="py-8 text-center">
            <p className="text-stone-600">Lab not found.</p>
            <button
              type="button"
              onClick={() => router.back()}
              className={`${ins.btnPrimary} mt-4`}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto w-4/5 max-w-5xl">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className={`${ins.btnSecondary} mb-4 inline-flex items-center gap-2`}
          >
            ← Back to Lab List
          </button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className={ins.h1}>Edit Lab</h1>
            <button
              type="button"
              onClick={() => router.push(`/instructor/labs-root?lab=${params.uid}`)}
              className={ins.btnPrimary}
            >
              Open Teacher Emulator
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="title" className={`${ins.label} mb-2`}>
            Lab Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={ins.input}
            placeholder="Enter lab title"
          />
        </div>

        <div className="mb-6">
          <label className={`${ins.label} mb-2`}>Lab Content</label>
          <div className="overflow-auto rounded-xl border border-white/15 bg-white shadow-inner">
            {typeof window !== 'undefined' && (
              <MdEditor
                modelValue={content}
                onChange={setContent}
                toolbarsExclude={['htmlPreview', 'catalog']}
                tableShape={[8, 15]} // columns, rows
                language="en-US"
                style={{ height: '700px' }}
              />
            )}
          </div>
        </div>

        {/* ================= Assign To Courses ================= */}
        <div className="mt-10">
          <h2 className={`${ins.h2} mb-4`}>Assign To Courses</h2>

          {coursesLoading && <p className="text-stone-600">Loading courses...</p>}

          {coursesError && <p className="text-red-800">{coursesError}</p>}

          {!coursesLoading && courses.length === 0 && (
            <p className="text-stone-600">No courses found.</p>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {courses.map((course) => (
              <label
                key={course.course_id}
                className={`${ins.listRow} cursor-pointer`}
              >
                <input
                  type="checkbox"
                  checked={selectedCourses.includes(course.course_id)}
                  onChange={() => toggleCourse(course.course_id)}
                  className="h-4 w-4 rounded border-stone-300 bg-white text-amber-600"
                />

                <span className="text-stone-900">
                  {course.code} — {course.title}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={saving ? ins.btnDisabled : ins.btnPrimary}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {saveSuccess && (
            <div className="font-medium text-emerald-800">Lab updated successfully!</div>
          )}

          {error && !loading && (
            <div className="font-medium text-red-800">Error: {error}</div>
          )}
        </div>

        <div className="mt-10">
          <h2 className={`${ins.h2} mb-4`}>Test Cases</h2>

          <div className={`${ins.card} ${ins.cardPad} mb-6`}>
            <h3 className={`${ins.h2Card} mb-3`}>Create Test Case</h3>
            <form onSubmit={handleCreateTestCase} className="flex flex-col gap-4 sm:flex-row">
              <div className="min-w-0 flex-1">
                <label htmlFor="testCaseName" className={`${ins.label} mb-1`}>
                  Test Case Name
                </label>
                <input
                  type="text"
                  id="testCaseName"
                  value={newTestCaseName}
                  onChange={(e) => setNewTestCaseName(e.target.value)}
                  className={ins.input}
                  placeholder="Enter test case name"
                  disabled={creatingTestCase}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={creatingTestCase || !newTestCaseName.trim()}
                  className={
                    creatingTestCase || !newTestCaseName.trim() ? ins.btnDisabled : ins.btnPrimary
                  }
                >
                  {creatingTestCase ? 'Creating...' : 'Create Test Case'}
                </button>
              </div>
            </form>
            {testCasesError && (
              <p className="mt-2 text-sm text-red-800">{testCasesError}</p>
            )}
          </div>

          {testCasesLoading ? (
            <div className="py-6 text-center">
              <div
                className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-stone-200 border-t-amber-600"
                aria-hidden
              />
              <p className="mt-2 text-stone-600">Loading test cases...</p>
            </div>
          ) : testCases.length === 0 ? (
            <p className="text-stone-600">No test cases yet.</p>
          ) : (
            <div>
              {testCases.map((testCase) => (
                <TestCaseEditor
                  key={testCase.uid}
                  testCase={testCase}
                  onDelete={handleDeleteTestCase}
                  onUpdate={handleUpdateTestCase}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
