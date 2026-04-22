'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listCourses } from '@/app/api/list_courses/frontend';
import { getCourseMembers } from '@/app/api/course_members/frontend';
import { removeCourseMember } from '@/app/api/remove_course_member/frontend';
import type { Course } from '@/app/api/list_courses/types';
import type { CourseMember } from '@/app/api/course_members/types';
import { ins } from '@/components/instructor-shell';

export default function DropMemberPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [members, setMembers] = useState<CourseMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    listCourses().then((res) => {
      if (res.success && res.courses) setCourses(res.courses);
    });
  }, []);

  useEffect(() => {
    if (!courseId || !/^[0-9]{5}$/.test(courseId)) {
      setMembers([]);
      return;
    }
    setLoadingMembers(true);
    getCourseMembers(courseId).then((res) => {
      if (res.success && res.members) setMembers(res.members);
      else setMembers([]);
      setLoadingMembers(false);
    });
  }, [courseId]);

  const handleRemove = async (username: string) => {
    if (
      !window.confirm(
        `Remove "${username}" from course ${courseId}?`
      )
    ) {
      return;
    }

    setMessage(null);
    setRemoving(username);
    try {
      const result = await removeCourseMember({ course_id: courseId, username });
      setMessage({ success: result.success, text: result.message || (result.success ? 'Dropped.' : 'Failed.') });
      if (result.success) {
        setMembers((prev) => prev.filter((m) => m.username !== username));
      }
    } catch (err) {
      setMessage({ success: false, text: err instanceof Error ? err.message : 'Error' });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className={ins.pageWrapSm}>
      <Link href="/instructor" className={ins.backLink}>
        ← Back to dashboard
      </Link>
      <h1 className={`${ins.h1} mt-4`}>Drop User from Course</h1>
      <p className={ins.subtitle}>Select a course, then remove a member from the roster.</p>

      {message && (
        <div className={`mt-4 ${message.success ? ins.msgOk : ins.msgErr}`}>
          {message.text}
        </div>
      )}

      <div className={`mt-6 space-y-4 ${ins.card} ${ins.cardPad}`}>
        <div>
          <label className={ins.label}>Course</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={ins.select}
          >
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </div>

        {courseId && (
          <div>
            {loadingMembers ? (
              <p className="text-stone-600">Loading roster...</p>
            ) : members.length === 0 ? (
              <p className="text-stone-600">No members in this course.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.username} className={ins.listRow}>
                    <span className="font-medium text-stone-900">{m.username}</span>
                    <span className="text-sm text-stone-600">{m.role}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(m.username)}
                      disabled={removing === m.username}
                      className={ins.btnDanger}
                    >
                      {removing === m.username ? 'Dropping...' : 'Drop'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
