'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listCourses } from '@/app/api/list_courses/frontend';
import { updateCourse } from '@/app/api/update_course/frontend';
import type { Course } from '@/app/api/list_courses/types';
import { ins } from '@/components/instructor-shell';

export default function ViewEditCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editTerm, setEditTerm] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCourses = async () => {
    setLoading(true);
    const res = await listCourses();
    if (res.success && res.courses) setCourses(res.courses);
    setLoading(false);
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const startEdit = (c: Course) => {
    setEditingId(c.course_id);
    setEditCode(c.code);
    setEditTitle(c.title);
    setEditTerm(c.term ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await updateCourse({
        course_id: editingId,
        code: editCode.trim(),
        title: editTitle.trim(),
        term: editTerm.trim() || undefined,
      });
      setMessage({ success: result.success, text: result.message || (result.success ? 'Saved.' : 'Failed.') });
      if (result.success) {
        setEditingId(null);
        loadCourses();
      }
    } catch (err) {
      setMessage({ success: false, text: err instanceof Error ? err.message : 'Error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={ins.pageWrapMd}>
      <Link href="/instructor" className={ins.backLink}>
        ← Back to dashboard
      </Link>
      <h1 className={`${ins.h1} mt-4`}>View / Edit Courses</h1>
      <p className={ins.subtitle}>Edit course details or manage roster from here.</p>

      {message && (
        <div className={`mt-4 ${message.success ? ins.msgOk : ins.msgErr}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-stone-600">Loading courses...</p>
      ) : courses.length === 0 ? (
        <p className="mt-6 text-stone-600">No courses yet. Create one from the dashboard.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {courses.map((c) => (
            <li key={c.course_id} className={`${ins.card} ${ins.cardPad}`}>
              {editingId === c.course_id ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-stone-600">Course ID: {c.course_id}</span>
                  </div>
                  <div>
                    <label className={ins.labelCaps}>Code</label>
                    <input
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className={ins.input}
                    />
                  </div>
                  <div>
                    <label className={ins.labelCaps}>Title</label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={ins.input}
                    />
                  </div>
                  <div>
                    <label className={ins.labelCaps}>Term</label>
                    <input
                      value={editTerm}
                      onChange={(e) => setEditTerm(e.target.value)}
                      className={ins.input}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={saving}
                      className={ins.btnPrimary}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={cancelEdit} className={ins.btnSecondary}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-stone-900">{c.code}</span>
                    <span className="ml-2 text-stone-600">({c.course_id})</span>
                    <p className="text-base font-medium text-stone-900">{c.title}</p>
                    {c.term && <p className="text-sm text-stone-700">{c.term}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEdit(c)} className={ins.btnNeutral}>
                      Edit
                    </button>
                    <Link
                      href={`/instructor/courses/roster?course_id=${c.course_id}`}
                      className={ins.btnNeutral}
                    >
                      Roster
                    </Link>
                    <Link
                      href={`/instructor/courses/labs?course_id=${c.course_id}`}
                      className={ins.btnNeutral}
                    >
                      Labs
                    </Link>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
