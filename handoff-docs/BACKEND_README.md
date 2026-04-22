# Backend README

The backend lives in `prototype_interp/`. It is a Flask app plus a simple RISC-V emulator.

## Main Responsibilities

- Parse submitted RISC-V assembly.
- Expand limited lab-style assembly helpers before execution.
- Execute instructions step by step and return machine states.
- Grade code against test cases stored in PostgreSQL.
- Track grade attempt usage and submission results for course labs.

## Important Files

- `server.py`: Flask routes, DB connection helper, grading logic, and app startup.
- `stringParse.py`: source tokenization, parser dispatch, `.data` / `.word` preprocessing, and pseudo/lab helper preprocessing.
- `instructions.py`: instruction classes and parse/execute behavior.
- `machine.py`: machine state, registers, memory, and program counter state.
- `runtime.py`: step/run loop that applies instructions to `MachineState`.
- `test_lw_sw.py`, `test_branches.py`, `test_instructions.py`: pytest coverage.

Ignore generated/dependency folders: `prototype_interp/.venv`, `prototype_interp/__pycache__`, and `.pytest_cache`.

## Flask Endpoints

The backend runs locally on `http://localhost:25565`.

- `POST /data`: run simulator code. Input includes `code`, optional `registers`, and optional `memory`. Output includes `hadError`, `errorMessage`, and `states`.
- `POST /score`: grade one test case by test UID.
- `POST /grade_lab`: grade all test cases for a lab in a course, enforce attempt limits, and save submission history when a grade session ID is present.
- `POST /grade_status`: return grade-attempt usage for a student/course/lab.

The frontend proxy routes in `riscv/app/api` call these endpoints.

## Emulator Pipeline

1. `server.py` receives code through `/data`, `/score`, or `/grade_lab`.
2. `preprocessAssemblyForEmulator` in `stringParse.py` handles supported lab source features.
3. `sourceToInstructions` converts source lines to `Instruction` objects.
4. `Runtime` starts from a `MachineState` and steps through instructions.
5. Each instruction mutates registers, memory, PC/jump flags, or both.
6. The route serializes states back to JSON using hex strings for register and memory values.

Memory is byte-addressed and the default machine has 1024 bytes of memory. `lw` and `sw` operate on 4-byte little-endian words and reject unaligned word accesses.

## Backend Environment

`server.py` loads `prototype_interp/.env` if present. It uses `DATABASE_URL` first:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

If `DATABASE_URL` is not set, it requires:

```text
DB_HOST=localhost
DB_NAME=capstone
DB_USER=capstone
DB_PASSWORD=capstone
DB_PORT=5432
```

## Commands

```bash
cd prototype_interp
uv sync
uv run python server.py
```

Run tests:

```bash
cd prototype_interp
uv run python -m pytest
```

Run a focused test file:

```bash
cd prototype_interp
uv run python -m pytest test_lw_sw.py
```

## Notes For Changes

- Add new instructions by implementing an `Instruction` subclass in `instructions.py`; subclasses are registered through `Instruction.KNOWN_INSTRUCTIONS`.
- Keep frontend/backend JSON shapes aligned with `riscv/components/types.ts`.
- Be careful when changing grading logic: `/grade_lab` both computes grades and writes submission history.
