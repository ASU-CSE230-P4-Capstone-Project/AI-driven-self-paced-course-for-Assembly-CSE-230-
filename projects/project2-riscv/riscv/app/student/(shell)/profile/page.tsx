import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DBConnection } from "@/app/sql/sql";
import { readVerifiedRequestAuth } from "@/app/verify/request-auth";

type UserProfileRow = {
  username: string;
  asuid: string | null;
};

type EnrolledCourseRow = {
  course_id: string;
  code: string;
  title: string;
  term: string | null;
  added_at: Date | string | null;
};

function formatEnrolledDate(value: Date | string | null): string {
  if (!value) {
    return "Not available";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export default async function StudentProfilePage() {
  const headerStore = await headers();
  const auth = readVerifiedRequestAuth(headerStore);
  const username = auth?.username ?? "";

  if (!username || auth?.student !== true) {
    redirect("/login");
  }

  let db: DBConnection | null = null;

  try {
    db = await DBConnection.create();

    const userResult = await db.client.query<UserProfileRow>(
      `SELECT username, asuid
       FROM users
       WHERE username = $1
       LIMIT 1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      redirect("/login");
    }

    const coursesResult = await db.client.query<EnrolledCourseRow>(
      `SELECT c.course_id, c.code, c.title, c.term, cm.added_at
       FROM course_memberships cm
       JOIN courses c ON c.course_id = cm.course_id
       WHERE cm.username = $1
         AND cm.role = 'student'
         AND cm.status = 'active'
       ORDER BY c.code ASC, c.term ASC NULLS LAST, c.title ASC`,
      [username]
    );

    const user = userResult.rows[0];
    const enrolledCourses = coursesResult.rows;
    const dateEnrolled =
      enrolledCourses.length > 0
        ? enrolledCourses.reduce<Date | string | null>((earliest, course) => {
            if (!earliest) return course.added_at;
            if (!course.added_at) return earliest;

            const earliestDate =
              earliest instanceof Date ? earliest : new Date(earliest);
            const candidateDate =
              course.added_at instanceof Date ? course.added_at : new Date(course.added_at);

            if (Number.isNaN(candidateDate.getTime())) return earliest;
            if (Number.isNaN(earliestDate.getTime())) return course.added_at;

            return candidateDate < earliestDate ? course.added_at : earliest;
          }, null)
        : null;

    return (
      <div className="mx-auto max-w-5xl py-8 md:py-10">
        <section className="px-1 py-4 sm:px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-400">
            Profile
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Student Profile
          </h1>
          <p className="mt-4 max-w-2xl text-base text-zinc-300 sm:text-lg">
            Basic account and enrollment details.
          </p>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <article className="rounded-[1.75rem] border border-zinc-700/80 bg-zinc-900/85 p-7 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Account
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Username
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{user.username}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  ASU ID
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {user.asuid?.trim() || "Not available"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Date Enrolled
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {enrolledCourses.length > 0
                    ? formatEnrolledDate(dateEnrolled)
                    : "No active courses yet"}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-zinc-700/80 bg-zinc-900/85 p-7 shadow-xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Enrolled Courses
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
                  {enrolledCourses.length}
                </h2>
              </div>
            </div>

            {enrolledCourses.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-5 py-4 text-sm text-zinc-300">
                You are not enrolled in any active courses right now.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {enrolledCourses.map((course) => (
                  <div
                    key={course.course_id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-5 py-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-white">{course.code}</p>
                        <p className="mt-1 text-sm text-zinc-300">{course.title}</p>
                      </div>
                      <div className="text-sm text-zinc-400 sm:text-right">
                        <p>{course.course_id}</p>
                        <p>{course.term || "Term not listed"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      </div>
    );
  } finally {
    if (db) {
      try {
        await db.client.end();
      } catch {}
    }
  }
}
