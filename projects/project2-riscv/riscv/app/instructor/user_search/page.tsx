"use client";

import { useState } from "react";
import Link from "next/link";
import { searchUsers } from "./api/frontend";
import type { UserSearchResult } from "./api/types";
import { ins } from "@/components/instructor-shell";

type RoleFilter = "any" | "student" | "instructor" | "ta";

const roleOptions: { value: RoleFilter; label: string }[] = [
  { value: "any", label: "Any role" },
  { value: "student", label: "Student" },
  { value: "instructor", label: "Instructor" },
  { value: "ta", label: "TA" },
];

const formatRole = (role?: string | null) => {
  if (!role) return "Unassigned";
  const normalized = role.toLowerCase();
  if (normalized === "instructor") return "Instructor";
  if (normalized === "student") return "Student";
  if (normalized === "ta") return "TA";
  return role;
};

export default function UserSearchPage() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("any");
  const [course, setCourse] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSearching(true);
    setHasSearched(true);
    setMessage(null);

    try {
      const response = await searchUsers({
        query,
        role,
        course,
      });

      if (response.success && response.users) {
        setResults(response.users);
        if (response.users.length === 0) {
          setMessage("No users matched this search.");
        }
      } else {
        setResults([]);
        setMessage(response.message ?? "Unable to search users.");
      }
    } catch (error) {
      setResults([]);
      setMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSearching(false);
    }
  };

  const showCourseRole = course.trim().length > 0;

  return (
    <div className={ins.pageWrapWide}>
      <div className="flex flex-col gap-2">
        <Link href="/instructor" className={ins.backLink}>
          Back to dashboard
        </Link>
        <h1 className={ins.h1}>User Search</h1>
        <p className={ins.subtitle}>
          Search registered users and filter by role or course. Results appear only after you press Search.
        </p>
      </div>

      <form onSubmit={handleSearch} className={`${ins.card} ${ins.cardPad} mt-6`}>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="query" className={ins.label}>
              Username
            </label>
            <input
              id="query"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by username"
              className={ins.input}
            />
          </div>

          <div>
            <label htmlFor="role" className={ins.label}>
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value as RoleFilter)}
              className={ins.select}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="course" className={ins.label}>
              Course
            </label>
            <input
              id="course"
              type="text"
              value={course}
              onChange={(event) => setCourse(event.target.value)}
              placeholder="Course ID or code"
              className={ins.input}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isSearching} className={ins.btnPrimary}>
            {isSearching ? "Searching..." : "Search"}
          </button>
          {message && <span className="text-sm font-medium text-stone-800">{message}</span>}
        </div>
      </form>

      <section className={`${ins.card} ${ins.cardPad} mt-6`}>
        <h2 className={ins.h2Card}>Results</h2>
        {!hasSearched && (
          <p className="mt-2 text-sm text-stone-600">Run a search to load user results.</p>
        )}

        {hasSearched && results.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={ins.tableHead}>
                <tr>
                  <th className={`${ins.tableCell} font-semibold text-stone-900`}>Username</th>
                  <th className={`${ins.tableCell} font-semibold text-stone-900`}>ASU ID</th>
                  <th className={`${ins.tableCell} font-semibold text-stone-900`}>Role</th>
                  <th className={`${ins.tableCell} font-semibold text-stone-900`}>Course</th>
                </tr>
              </thead>
              <tbody className={ins.divideList}>
                {results.map((user) => {
                  const roleLabel = showCourseRole
                    ? formatRole(user.courseRole)
                    : role === "ta"
                      ? "TA"
                      : user.instructor
                        ? "Instructor"
                        : "Student";
                  const courseLabel = showCourseRole ? user.courseId ?? course.trim() : "—";

                  return (
                    <tr key={user.username}>
                      <td className={`${ins.tableCell} font-medium text-stone-900`}>{user.username}</td>
                      <td className={ins.tableCell}>{user.asuid ?? "—"}</td>
                      <td className={ins.tableCell}>{roleLabel}</td>
                      <td className={ins.tableCell}>{courseLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {hasSearched && results.length === 0 && !message && (
          <p className="mt-2 text-sm text-stone-600">No users matched this search.</p>
        )}
      </section>
    </div>
  );
}
