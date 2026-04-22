# Architecture Diagram

This document gives a high-level view of the Capstone2 RISC-V app based on the current repo layout and runtime wiring.

## System Overview

```mermaid
flowchart LR
  Browser["User Browser"]

  subgraph Next["Next.js Web App (riscv/)"]
    Middleware["Route protection and role redirects<br/>middleware.ts + app/verify/*"]
    Pages["App Router pages<br/>student / instructor / TA / auth"]
    Components["React UI components<br/>editor, simulator panels, course tools"]
    APIs["Next API routes<br/>DB-backed routes + backend proxy routes"]

    Middleware --> Pages
    Pages --> Components
    Pages --> APIs
    Components --> APIs
  end

  subgraph Flask["Python Backend (prototype_interp/)"]
    Routes["Flask endpoints<br/>/data, /score, /grade_lab, /grade_status"]
    Parser["Assembly parsing and preprocessing<br/>stringParse.py"]
    Runtime["Execution engine<br/>runtime.py, instructions.py, machine.py"]

    Routes --> Parser --> Runtime
  end

  subgraph DB["PostgreSQL"]
    Core["Core tables<br/>users, labs, test_cases, secrets"]
    Course["Course and persistence tables<br/>memberships, labs, projects, sessions, submissions"]
    Sessions["Auth session table<br/>auth_sessions"]
  end

  subgraph Setup["Schema and Seed Inputs"]
    SQL["Idempotent setup scripts<br/>SQL_SETUP/setupDB_Master.sql + feature scripts"]
    Seeds["Lab seed files<br/>db-seeds/*.sql"]
  end

  Browser -->|"HTTP requests + cookie"| Middleware
  Browser -->|"Public pages and client actions"| Pages
  APIs -->|"Direct SQL queries"| DB
  APIs -->|"Proxy requests via BACKEND_URL"| Routes
  Routes -->|"Read/write grading and lab data"| DB
  SQL --> DB
  Seeds --> DB
```

## Simulator and Grading Flow

```mermaid
flowchart TD
  UserAction["Student or staff action<br/>run code / submit lab / check grading"]
  UI["Next.js UI<br/>use-runner.ts, lab pages, staff pages"]
  NextRoute["Next API route<br/>/api/run, /api/score, /api/grade_lab, /api/grade_status"]
  Auth["Auth check when required<br/>verifyCookieInternal"]
  FlaskRoute["Flask route<br/>/data, /score, /grade_lab, /grade_status"]
  Parse["Preprocess and parse assembly<br/>preprocessAssemblyForEmulator + sourceToInstructions"]
  Execute["Execute on machine state<br/>runtime + instruction classes"]
  GradeDB["PostgreSQL lookups and writes<br/>test cases, attempts, submissions"]
  Response["JSON response<br/>states, scores, pass/fail, errors"]
  Display["UI updates<br/>registers, memory, grade status, feedback"]

  UserAction --> UI --> NextRoute
  NextRoute --> Auth
  Auth --> FlaskRoute
  FlaskRoute --> Parse --> Execute
  FlaskRoute --> GradeDB
  Execute --> Response
  GradeDB --> Response
  Response --> NextRoute --> Display
```

## Primary Responsibility Split

- `riscv/`: user-facing web app, auth/session handling, course/lab/project UI, and server API routes.
- `prototype_interp/`: RISC-V parsing, execution, grading logic, and backend endpoints.
- `SQL_SETUP/`: schema setup and migration-style SQL.
- `db-seeds/`: standalone lab seed content loaded after schema setup.

## Source of Truth Files

- Web entry points: `riscv/app/*`
- Web API routes: `riscv/app/api/*`
- Web DB access: `riscv/app/sql/sql.tsx`
- Auth/session logic: `riscv/app/verify/*`, `riscv/middleware.ts`
- Backend service: `prototype_interp/server.py`
- Emulator core: `prototype_interp/stringParse.py`, `prototype_interp/runtime.py`, `prototype_interp/instructions.py`, `prototype_interp/machine.py`
- Schema setup: `SQL_SETUP/setupDB_Master.sql`
