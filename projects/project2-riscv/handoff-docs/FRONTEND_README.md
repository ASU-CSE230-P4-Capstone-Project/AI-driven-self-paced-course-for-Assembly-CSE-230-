# Frontend README

The frontend lives in `riscv/` and is a Next.js app using the App Router.

## Main Responsibilities

- Auth screens and session handling.
- Student projects and lab workspace UI.
- Instructor and TA course/lab/submission pages.
- RISC-V editor, register/memory input presets, simulator controls, and display panels.
- Next API routes that either query PostgreSQL directly or proxy requests to the Python backend.

## Important Folders

- `riscv/app/`: Next.js route tree.
- `riscv/app/api/`: server-side API routes.
- `riscv/app/sql/sql.tsx`: PostgreSQL pool setup. It uses `DATABASE_URL`.
- `riscv/app/verify/`: session verification and cookie helpers.
- `riscv/components/`: shared UI and simulator components.
- `riscv/public/`: static assets.

Ignore generated/dependency folders: `riscv/.next`, `riscv/.next-dev`, and `riscv/node_modules`.

## Major Route Areas

- Public auth: `riscv/app/login`, `riscv/app/register`, `riscv/app/logout`.
- Student shell: `riscv/app/student`, `riscv/app/student/labs`, `riscv/app/student/projects`.
- Instructor shell: `riscv/app/instructor`, `riscv/app/instructor/courses`, `riscv/app/instructor/labs`, `riscv/app/instructor/simulator`.
- TA shell: `riscv/app/ta`, `riscv/app/ta/courses`, `riscv/app/ta/simulator`.
- Shared legacy/project pages: `riscv/app/projects`, `riscv/app/labs`, `riscv/app/new-project`.

## API Route Pattern

Most API routes are under `riscv/app/api/<name>/route.tsx` or `route.ts`.

Direct database routes use `DBConnection.create()` from `riscv/app/sql/sql.tsx`. Examples include course, lab, workspace, session, user settings, and submission history routes.

Simulator/grading proxy routes call the Flask backend using `BACKEND_URL`, defaulting to `http://localhost:25565` for local development:

- `riscv/app/api/run/route.ts` -> `POST /data`
- `riscv/app/api/score/route.tsx` -> `POST /score`
- `riscv/app/api/grade_lab/route.tsx` -> `POST /grade_lab`
- `riscv/app/api/grade_status/route.tsx` -> `POST /grade_status`

If the backend is not running, simulator and grading calls will fail even if the frontend is running.

## Simulator UI Flow

- `riscv/components/use-runner.ts` sends code, register overrides, and memory overrides to `/api/run`.
- `/api/run` proxies the request to the backend.
- The backend returns an array of machine states with registers and memory as hex strings.
- `AssemblyInfo` displays changed/seeded registers and memory.
- `RegisterEditor` and `MemoryEditor` use `OverrideListEditor` to collect input presets.
- `MemoryVisualPanel`, `SevenSegment`, and `Led` render the memory-mapped display/LED visualization.

Student lab state is handled through `riscv/components/lab_root.tsx`. General project state is handled through `riscv/components/root.tsx`. Staff sandbox behavior is handled through `riscv/components/staff-simulator.tsx`.

## Persistence Areas

- Browser/local workspace state uses helpers in `riscv/components/workspace-store.ts`.
- Remote project/session persistence uses API routes such as `sync_workspace`, `load_workspace`, `sync_lab_session`, and `load_lab_session`.
- User settings use `riscv/app/api/user_settings`.

## Common Frontend Commands

```bash
cd riscv
npm ci
npm run dev
npm run build
npm run lint
```

Use `npm run clean:next` or `npm run clean:next:dev` when generated Next output becomes stale or pollutes lint/type checks.
