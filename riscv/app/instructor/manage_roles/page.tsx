"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ins } from "@/components/instructor-shell";
import { updateCourseRole } from "./api/frontend";
import type { CourseMembershipRole, ManageRoleMembership } from "./api/types";
import { searchUsers } from "@/app/instructor/user_search/api/frontend";
import { getMissingAsuidMessage, isValidAsuid } from "@/app/lib/asuid";

const roleOptions: Array<{ value: CourseMembershipRole; label: string }> = [
  { value: "student", label: "Student" },
  { value: "ta", label: "TA" },
  { value: "instructor", label: "Instructor" },
];

export default function ManageRolesPage() {
  const [username, setUsername] = useState("");
  const [courseId, setCourseId] = useState("");
  const [role, setRole] = useState<CourseMembershipRole>("student");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [lastChange, setLastChange] = useState<ManageRoleMembership | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (role === "instructor") {
      const shouldProceed = window.confirm(
        "Promoting this user to Instructor grants instructor dashboard access and course staff permissions. Do you want to proceed?"
      );

      if (!shouldProceed) {
        return;
      }
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const trimmedUsername = username.trim();
      const userLookup = await searchUsers({ query: trimmedUsername, role: "any" });
      const matchedUser = userLookup.users?.find((user) => user.username === trimmedUsername);

      if (matchedUser && !isValidAsuid(matchedUser.asuid)) {
        setMessage({
          success: false,
          text: getMissingAsuidMessage(trimmedUsername, "be assigned to a course"),
        });
        return;
      }

      const response = await updateCourseRole({
        username: trimmedUsername,
        courseId: courseId.trim(),
        role,
      });

      setMessage({
        success: response.success,
        text: response.message,
      });

      if (response.success && response.membership) {
        setLastChange(response.membership);
      }
    } catch (error) {
      setMessage({
        success: false,
        text: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={ins.pageWrapSm}>
      <div>
        <Link href="/instructor" className={ins.backLink}>
          ← Back to dashboard
        </Link>
        <p className={`${ins.kicker} mt-4`}>Roles</p>
        <h1 className={`${ins.h1} mt-2`}>Manage course roles</h1>
        <p className={ins.subtitle}>
          Promote or demote a course member between student, TA, and instructor roles.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={`${ins.card} ${ins.cardPad} space-y-5`}>
        <div>
          <label htmlFor="username" className={ins.label}>
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter username"
            required
            className={ins.input}
          />
          <p className="mt-2 text-xs text-stone-600">
            Users must already have a valid 10-digit ASUID before they can be assigned to a course.
          </p>
        </div>

        <div>
          <label htmlFor="courseId" className={ins.label}>
            Course ID
          </label>
          <input
            id="courseId"
            type="text"
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            placeholder="5-digit course ID"
            required
            pattern="[0-9]{5}"
            maxLength={5}
            className={ins.input}
          />
        </div>

        <div>
          <label htmlFor="role" className={ins.label}>
            New role
          </label>
          <select
            id="role"
            value={role}
            onChange={(event) => setRole(event.target.value as CourseMembershipRole)}
            className={ins.select}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isSubmitting} className={ins.btnPrimary}>
            {isSubmitting ? "Updating..." : "Update role"}
          </button>
          {message && (
            <span className={`text-sm font-medium ${message.success ? "text-emerald-900" : "text-red-700"}`}>
              {message.text}
            </span>
          )}
        </div>
      </form>

      {lastChange && (
        <section className={`${ins.card} ${ins.cardPad}`}>
          <h2 className={ins.h2Card}>Last change</h2>
          <p className="mt-2 text-sm text-stone-700">
            <span className="font-semibold text-stone-900">{lastChange.username}</span> is now{" "}
            <span className="font-semibold uppercase text-amber-800">{lastChange.role}</span> in
            course <span className="font-semibold text-stone-900">{lastChange.courseId}</span>.
          </p>
          {lastChange.previousRole && (
            <p className="mt-1 text-sm text-stone-600">
              Previous role:{" "}
              <span className="font-medium text-stone-900">{lastChange.previousRole}</span>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
