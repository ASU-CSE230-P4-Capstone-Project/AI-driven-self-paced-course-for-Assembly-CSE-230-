import os
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import OperationalError
from sqlalchemy import text

from app.models import domain_models
from app.services.db import SessionLocal, engine
from app.api import auth, fetch, pinecone, progress, modules
    #, webhooks, ai, analytics, pushback, health
from app.services.pushback_service import router as pushback_router

app = FastAPI(title="Canvas AI Tutor")

# Static files (uploaded PDFs, etc.)
_static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(_static_dir, "uploads"), exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_dir), name="static")

raw_origins = os.getenv("CORS_ALLOW_ORIGINS")
if raw_origins:
    allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
else:
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
    ]

allow_credentials = True
if "*" in allowed_origins:
    allowed_origins = ["*"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=allow_credentials,
)

@app.on_event("startup")
def _init_db_with_retry() -> None:
    """
    Docker Compose often starts the backend before Postgres is ready to accept
    connections. If we run create_all() at import time, the process crashes and
    the frontend sees "Failed to fetch". Retry briefly on startup instead.
    """

    max_wait_s = int(os.getenv("DB_INIT_MAX_WAIT_SECONDS", "45"))
    deadline = time.time() + max_wait_s
    attempt = 0

    while True:
        attempt += 1
        try:
            domain_models.Base.metadata.create_all(bind=engine)
            # Lightweight migration for added user columns (no Alembic in this repo)
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR"))
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS sis_user_id VARCHAR"))
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR"))
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS professor_name VARCHAR"))
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_journey VARCHAR"))
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_track VARCHAR"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users(email)"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_sis_user_id ON users(sis_user_id)"))
                # Normalize legacy roles to current scheme (student/staff)
                conn.execute(text("UPDATE users SET role = 'staff' WHERE lower(coalesce(role,'')) IN ('professor','teacher','ta')"))
                conn.execute(text("UPDATE users SET role = 'student' WHERE role IS NULL OR trim(role) = ''"))
                # If we seeded explicit integer IDs, ensure sequences are advanced.
                conn.execute(text("SELECT setval(pg_get_serial_sequence('modules','id'), COALESCE((SELECT MAX(id) FROM modules), 1))"))
                conn.execute(text("SELECT setval(pg_get_serial_sequence('module_resources','id'), COALESCE((SELECT MAX(id) FROM module_resources), 1))"))
                conn.execute(text("ALTER TABLE module_resources ADD COLUMN IF NOT EXISTS content_markdown TEXT"))

            # Seed initial module catalog (idempotent)
            seed_modules = [
                # Published by default (matches current student dashboard behavior)
                {
                    "id": 1,
                    "title": "Introduction to Computer Architecture",
                    "description": "Abstraction layers, performance metrics, instruction sets, MIPS basics.",
                    "is_published": True,
                    "readings": [
                        ("Computer Abstraction and Technology", "20 min"),
                        ("Performance Metrics: CPI, Clock Rate", "18 min"),
                        ("Instruction Set Principles", "22 min"),
                        ("Introduction to MIPS Architecture", "25 min"),
                    ],
                    "videos": [
                        ("Overview of Computer Architecture", "15 min"),
                        ("Performance Evaluation Techniques", "18 min"),
                        ("MIPS Assembly Basics", "25 min"),
                        ("MIPS Instruction Set Deep Dive", "30 min"),
                    ],
                },
                {
                    "id": 2,
                    "title": "MIPS Introduction, ALU and Data Transfer",
                    "description": "MIPS registers, arithmetic operations, load/store instructions, memory addressing.",
                    "is_published": True,
                    "readings": [
                        ("MIPS Register File and Conventions", "20 min"),
                        ("Arithmetic and Logical Operations", "18 min"),
                        ("Load and Store Instructions", "22 min"),
                        ("Memory Addressing Modes", "25 min"),
                    ],
                    "videos": [
                        ("MIPS Register Architecture", "15 min"),
                        ("ALU Operations in MIPS", "18 min"),
                        ("Data Transfer Instructions", "25 min"),
                        ("Memory Access Patterns", "30 min"),
                    ],
                },
                {
                    "id": 3,
                    "title": "Branch Instructions and Machine Code",
                    "description": "Conditional branching, jump instructions, encoding MIPS to machine code.",
                    "is_published": True,
                    "readings": [
                        ("Conditional Branch Instructions", "20 min"),
                        ("Jump and Jump Register", "18 min"),
                        ("MIPS Instruction Encoding", "22 min"),
                        ("Machine Code Format", "25 min"),
                    ],
                    "videos": [
                        ("Branch Instruction Types", "15 min"),
                        ("Control Flow in MIPS", "18 min"),
                        ("Instruction Encoding", "25 min"),
                        ("Machine Code Examples", "30 min"),
                    ],
                },
                # Locked/unpublished by default (matches current UI where 4..13 are locked)
                {
                    "id": 4,
                    "title": "Procedure Execution",
                    "description": "Function calls, stack frames, register conventions, procedure linkage.",
                    "is_published": False,
                    "readings": [
                        ("Function Call Mechanism", "20 min"),
                        ("Stack Frame Structure", "18 min"),
                        ("Register Conventions ($ra, $sp, $fp)", "22 min"),
                        ("Procedure Linkage and Return", "25 min"),
                    ],
                    "videos": [
                        ("Introduction to Procedures", "15 min"),
                        ("Stack Management", "18 min"),
                        ("Calling Conventions", "25 min"),
                        ("Nested Procedure Calls", "30 min"),
                    ],
                },
                {
                    "id": 5,
                    "title": "Linking, Loading and MIPS Summary",
                    "description": "Object files, linking process, loaders, MIPS instruction set summary.",
                    "is_published": False,
                    "readings": [
                        ("Object File Format", "20 min"),
                        ("Static Linking Process", "18 min"),
                        ("Dynamic Linking", "22 min"),
                        ("MIPS Instruction Set Reference", "25 min"),
                    ],
                    "videos": [
                        ("Object Files and Symbols", "15 min"),
                        ("Linker Operation", "18 min"),
                        ("Loader and Execution", "25 min"),
                        ("Complete MIPS Reference", "30 min"),
                    ],
                },
                {
                    "id": 6,
                    "title": "Arithmetic For Computers",
                    "description": "Integer arithmetic, floating point representation, arithmetic operations.",
                    "is_published": False,
                    "readings": [
                        ("Integer Addition and Subtraction", "20 min"),
                        ("Integer Multiplication and Division", "18 min"),
                        ("Floating Point Representation", "22 min"),
                        ("Floating Point Operations", "25 min"),
                    ],
                    "videos": [
                        ("Integer Arithmetic Operations", "15 min"),
                        ("Multiplication Algorithms", "18 min"),
                        ("IEEE 754 Floating Point", "25 min"),
                        ("Floating Point Arithmetic", "30 min"),
                    ],
                },
                {
                    "id": 7,
                    "title": "Single Cycle Implementation",
                    "description": "Single cycle datapath, control unit design, instruction execution.",
                    "is_published": False,
                    "readings": [
                        ("Single Cycle Datapath Design", "20 min"),
                        ("Control Unit Implementation", "18 min"),
                        ("Instruction Execution Flow", "22 min"),
                        ("Performance Limitations", "25 min"),
                    ],
                    "videos": [
                        ("Datapath Components", "15 min"),
                        ("Control Signals", "18 min"),
                        ("Complete Single Cycle CPU", "25 min"),
                        ("Timing and Clock Cycles", "30 min"),
                    ],
                },
                {
                    "id": 8,
                    "title": "Multicycle Implementation",
                    "description": "Multicycle datapath, finite state machine control, performance tradeoffs.",
                    "is_published": False,
                    "readings": [
                        ("Multicycle Datapath Design", "20 min"),
                        ("Finite State Machine Control", "18 min"),
                        ("Instruction Execution States", "22 min"),
                        ("Performance Analysis", "25 min"),
                    ],
                    "videos": [
                        ("Multicycle Approach", "15 min"),
                        ("State Machine Design", "18 min"),
                        ("Instruction Execution", "25 min"),
                        ("Performance Comparison", "30 min"),
                    ],
                },
                {
                    "id": 9,
                    "title": "Pipeline Implementation and Exception Handling",
                    "description": "Pipeline stages, hazards, forwarding, exception handling.",
                    "is_published": False,
                    "readings": [
                        ("Pipeline Stages and Structure", "20 min"),
                        ("Data Hazards and Forwarding", "18 min"),
                        ("Control Hazards and Branch Prediction", "22 min"),
                        ("Exception Handling in Pipelines", "25 min"),
                    ],
                    "videos": [
                        ("Pipeline Fundamentals", "15 min"),
                        ("Hazard Detection", "18 min"),
                        ("Forwarding and Stalling", "25 min"),
                        ("Exception Mechanisms", "30 min"),
                    ],
                },
                {
                    "id": 10,
                    "title": "Memory Hierarchy and Direct Mapped Caches",
                    "description": "Memory hierarchy, cache organization, direct mapped cache design.",
                    "is_published": False,
                    "readings": [
                        ("Memory Hierarchy Principles", "20 min"),
                        ("Cache Organization Basics", "18 min"),
                        ("Direct Mapped Cache Design", "22 min"),
                        ("Cache Performance Metrics", "25 min"),
                    ],
                    "videos": [
                        ("Memory Hierarchy Overview", "15 min"),
                        ("Cache Fundamentals", "18 min"),
                        ("Direct Mapped Implementation", "25 min"),
                        ("Cache Performance Analysis", "30 min"),
                    ],
                },
                {
                    "id": 11,
                    "title": "Associative Caches",
                    "description": "Fully associative, set-associative caches, replacement policies.",
                    "is_published": False,
                    "readings": [
                        ("Fully Associative Caches", "20 min"),
                        ("Set-Associative Cache Design", "18 min"),
                        ("Replacement Policies (LRU, FIFO)", "22 min"),
                        ("Cache Performance Optimization", "25 min"),
                    ],
                    "videos": [
                        ("Associative Cache Concepts", "15 min"),
                        ("Set-Associative Implementation", "18 min"),
                        ("Replacement Algorithms", "25 min"),
                        ("Cache Optimization Techniques", "30 min"),
                    ],
                },
                {
                    "id": 12,
                    "title": "Virtual Memory",
                    "description": "Virtual addresses, page tables, TLB, memory protection.",
                    "is_published": False,
                    "readings": [
                        ("Virtual Memory Concepts", "20 min"),
                        ("Page Table Organization", "18 min"),
                        ("Translation Lookaside Buffer (TLB)", "22 min"),
                        ("Memory Protection and Sharing", "25 min"),
                    ],
                    "videos": [
                        ("Virtual Memory Overview", "15 min"),
                        ("Address Translation", "18 min"),
                        ("TLB Design and Operation", "25 min"),
                        ("Memory Management", "30 min"),
                    ],
                },
                {
                    "id": 13,
                    "title": "Parallel Processors",
                    "description": "Parallelism, multiprocessors, shared memory, synchronization.",
                    "is_published": False,
                    "readings": [
                        ("Parallel Processing Fundamentals", "20 min"),
                        ("Multiprocessor Architectures", "18 min"),
                        ("Shared Memory Systems", "22 min"),
                        ("Synchronization Mechanisms", "25 min"),
                    ],
                    "videos": [
                        ("Introduction to Parallelism", "15 min"),
                        ("Multiprocessor Design", "18 min"),
                        ("Shared Memory Consistency", "25 min"),
                        ("Synchronization Primitives", "30 min"),
                    ],
                },
            ]

            # Optional module seeding (disabled by default).
            # If you want a bootstrap catalog for local dev, set SEED_MODULES=true.
            seed_enabled = (os.getenv("SEED_MODULES", "") or "").strip().lower() in ("1", "true", "yes", "on")
            if seed_enabled:
                db = SessionLocal()
                try:
                    existing_count = db.query(domain_models.Module).count()
                    if existing_count == 0:
                        for m in seed_modules:
                            mod = domain_models.Module(
                                id=int(m["id"]),
                                title=str(m["title"]),
                                description=str(m["description"]),
                                is_published=bool(m["is_published"]),
                            )
                            db.add(mod)
                            db.flush()

                            for (t, dur) in m.get("readings", []):
                                db.add(
                                    domain_models.ModuleResource(
                                        module_id=int(m["id"]),
                                        kind="reading",
                                        title=str(t),
                                        duration=str(dur),
                                    )
                                )
                            for (t, dur) in m.get("videos", []):
                                db.add(
                                    domain_models.ModuleResource(
                                        module_id=int(m["id"]),
                                        kind="video",
                                        title=str(t),
                                        duration=str(dur),
                                    )
                                )
                        db.commit()
                finally:
                    db.close()
            return
        except OperationalError:
            if time.time() >= deadline:
                raise
            # capped backoff: 0.5s, 1s, 2s, 3s, 3s, ...
            sleep_s = min(3.0, 0.5 * (2 ** max(0, attempt - 1)))
            time.sleep(sleep_s)

# app.include_router(health.router, prefix="/")
app.include_router(auth.router, prefix="/auth")
app.include_router(fetch.router, prefix="/fetch")
app.include_router(progress.router, prefix="/progress")
app.include_router(modules.router)
app.include_router(pinecone.router)
app.include_router(pushback_router, prefix="/pushback")
# app.include_router(webhooks.router, prefix="/webhooks")
# app.include_router(ai.router, prefix="/ai")
# app.include_router(analytics.router, prefix="/analytics")
# app.include_router(pushback.router, prefix="/pushback")
#
