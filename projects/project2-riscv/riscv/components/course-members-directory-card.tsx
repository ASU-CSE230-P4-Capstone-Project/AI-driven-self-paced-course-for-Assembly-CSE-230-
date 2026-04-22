'use client';

import * as React from 'react';
import type { CourseMember } from '@/app/api/course_members/types';
import { ins } from '@/components/instructor-shell';

type CourseMembersDirectoryCardProps = {
  members: CourseMember[];
};

function formatRole(role: string) {
  return role.replace(/_/g, ' ');
}

function formatStatus(status?: string | null) {
  return status?.trim() ? status : 'unknown';
}

function formatAsuid(asuid?: string | null) {
  return asuid?.trim() ? asuid.trim() : 'Not available';
}

export default function CourseMembersDirectoryCard({
  members,
}: CourseMembersDirectoryCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <section
      ref={containerRef}
      className={`${ins.card} relative z-20 max-w-sm overflow-visible`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className={ins.labelCaps}>Course roster</p>
          <p className="mt-1 text-sm text-stone-600">
            {members.length} member{members.length === 1 ? '' : 's'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:border-amber-300 hover:bg-orange-50"
        >
          {isOpen ? 'Hide roster' : 'Show roster'}
        </button>
      </div>

      {!isOpen ? null : (
        <div className="absolute left-0 top-full z-30 mt-2 w-[calc(100vw-2rem)] max-w-3xl rounded-2xl border border-amber-200 bg-white shadow-xl shadow-amber-950/15 ring-1 ring-amber-100">
          <div className="border-b border-amber-100 px-5 py-4">
            <p className={ins.labelCaps}>Member list</p>
            <p className="mt-1 text-sm text-stone-600">
              All names, ASUIDs, roles, and statuses in one place.
            </p>
          </div>

          {members.length === 0 ? (
            <div className="px-5 py-5 text-sm text-stone-600">
              No members are enrolled in this course yet.
            </div>
          ) : (
            <ul className={`${ins.divideList} max-h-[24rem] overflow-auto`}>
              {members.map((member) => (
                <li
                  key={member.username}
                  className="px-5 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {member.name?.trim() || member.username}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-600">@{member.username}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-stone-700">
                        ASUID {formatAsuid(member.asuid)}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                        {formatRole(member.role)}
                      </span>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                        {formatStatus(member.status)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
