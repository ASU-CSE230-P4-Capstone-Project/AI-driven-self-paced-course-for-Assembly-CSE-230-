'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createCourse } from '@/app/api/create_course/frontend';
import { ins } from '@/components/instructor-shell';

export default function CreateCoursePage() {
  const [courseId, setCourseId] = useState('');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [term, setTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!/^[0-9]{5}$/.test(courseId)) {
      setMessage({ success: false, text: 'Course ID must be exactly 5 digits' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await createCourse({
        course_id: courseId,
        code: code.trim(),
        title: title.trim(),
        term: term.trim() || undefined,
      });
      setMessage({ success: result.success, text: result.message || (result.success ? 'Course created.' : 'Failed.') });
      if (result.success) {
        setCourseId('');
        setCode('');
        setTitle('');
        setTerm('');
      }
    } catch (err) {
      setMessage({ success: false, text: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={ins.pageWrapSm}>
      <Link href="/instructor" className={ins.backLink}>
        ← Back to dashboard
      </Link>
      <h1 className={`${ins.h1} mt-4`}>Create New Course</h1>
      <p className={ins.subtitle}>Course ID must be 5 digits (e.g. 10101).</p>

      {message && (
        <div className={`mt-4 ${message.success ? ins.msgOk : ins.msgErr}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className={`mt-6 space-y-4 ${ins.card} ${ins.cardPad}`}>
        <div>
          <label htmlFor="course_id" className={ins.label}>
            Course ID (5 digits)
          </label>
          <input
            id="course_id"
            type="text"
            maxLength={5}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value.replace(/\D/g, ''))}
            className={ins.input}
            required
          />
        </div>
        <div>
          <label htmlFor="code" className={ins.label}>
            Code
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. CS101"
            className={ins.input}
            required
          />
        </div>
        <div>
          <label htmlFor="title" className={ins.label}>
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Introduction to RISC-V"
            className={ins.input}
            required
          />
        </div>
        <div>
          <label htmlFor="term" className={ins.label}>
            Term (optional)
          </label>
          <input
            id="term"
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. Fall 2025"
            className={ins.input}
          />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" disabled={submitting} className={ins.btnPrimary}>
            {submitting ? 'Creating...' : 'Create Course'}
          </button>
          <Link href="/instructor" className={ins.btnSecondary}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
