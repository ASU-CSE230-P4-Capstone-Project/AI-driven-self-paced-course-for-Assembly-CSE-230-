# Database And SQL

The database is PostgreSQL. The frontend and backend both connect to the same database.

## Source Files

- `SQL_SETUP/setupDB_Master.sql`: preferred schema setup entry point.
- `SQL_SETUP/setupDB_Init.sql`: original core tables and older seed content.
- `SQL_SETUP/setupDB_*.sql`: idempotent setup/migration scripts grouped by feature.
- `db-seeds/`: newer standalone lab seed files.

## Table Groups

Core:

- `users`: app users and role/profile fields.
- `secrets`: app secret storage.
- `labs`: lab definitions and Markdown instructions.
- `test_cases`: seed/result register and memory JSON for lab grading.

Workspace/session persistence:

- `workspaces`: per-user current workspace pointer.
- `workspace_projects`: saved project code and simulator state.
- `lab_sessions`: saved student lab code and simulator state.
- `user_settings`: editor/UI preferences.

Courses and membership:

- `courses`: course records.
- `course_memberships`: user membership and role in a course.
- `course_labs`: labs assigned to courses.
- `lab_grades`: older lab-grade records.

Attempts/submissions:

- `grade_attempts`, `grade_attempt_sessions`: older per-lab attempt tracking.
- `course_grade_attempts`, `course_grade_attempt_sessions`: course-aware attempt tracking.
- `course_lab_submissions`: submission history and aggregate grade records.

TA/section support:

- `ta_profiles`
- `course_sections`
- `ta_section_enrollments`
- Functions such as `assign_ta_to_section` and `unassign_ta_from_section`.

## Seed Data

Use `db-seeds/` for the newer production-style lab seeds:

- `seed_lab0_intro_addition.sql`
- `seed_lab1_intro_subtraction.sql`
- `seed_lab2_intro_bitwise_and.sql`

After seeding labs, assign them to courses in the instructor UI or by inserting into `public.course_labs`.

## Migration Cautions

- Do not run ad hoc destructive SQL against shared or hosted databases.
- Keep new schema changes idempotent where possible.
- If adding a table that depends on another table, add it after its parent table setup script in `setupDB_Master.sql`.
- Keep test-case JSON shapes compatible with backend grading: `seed_registers`, `seed_memory`, `result_registers`, and `result_memory` are JSON maps of string keys to hex string values.
- Do not commit real database URLs or credentials.
