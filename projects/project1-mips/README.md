# MIPS32 Emulator 

## Project Overview
This project is a lab suite and web IDE (similar to ZyBooks), featuring a MIPS32 emulator written in Rust. The Rust code is compiled to WASM so the IDE may integrate the emulator component. It includes a full autograding pipeline, a professor dashboard for lab and grade management, a test case generator, and role-based access for instructors, TAs, and students.

### Feature Completion:
**Emulator (Rust Core)**:
- Core Emulator [x]
- ISA Specifications [x]
- Memory Manager [x]
- MMIO Spec [x]

**Full Stack**:
- Web IDE [x]
- Serverless Autograder [x]
- Persistent Lab Progress (Neon/PostgreSQL) [x]
- Professor Dashboard [x]
- Role-based Access Control (Instructor / TA / Student) [x]
- Student Roster Management [x]
- Manual Grade Overrides [x]
- Grade Export (Excel / ZIP / CSV) [x]
- Test Case Generator [x]
- Solution Code Storage and Verification [x]

---

## Architecture

The application is split into three main components to fit Vercel's stateless constraints:
1. **Frontend**: Static HTML/JS/CSS served via `@vercel/static`.
2. **API Backend**: Python (Flask) serverless functions for user management, lab logic, and grade submission.
3. **Emulator Service**: A Node.js serverless function that imports the WASM core (compiled for `nodejs`) to grade student code in-process.

---

## Repository Structure

```
mips-emulator/
├── Cargo.toml                  # Rust project config
├── Cargo.lock
├── rust-toolchain.toml
├── src/                        # Rust emulator source code
│   ├── lib.rs
│   ├── cpu.rs
│   └── ...
├── schema.sql                  # Database schema
├── migrate_labs.py             # Lab seeding script
├── labs_curriculum.json        # Lab content and test cases
├── deploy/                     # Vercel deployment directory
│   ├── vercel.json             # Vercel routing config
│   ├── requirements.txt        # Python dependencies
│   ├── package.json            # Node.js config
│   ├── api/                    # Serverless functions
│   │   ├── index.py            # Flask app (all API routes)
│   │   ├── _db.py              # Neon DB connection helper
│   │   ├── _auth.py            # Auth routes
│   │   ├── _autograder.py      # Grading logic + verify endpoint
│   │   ├── emulator.js         # Node.js WASM grader
│   │   └── pkg-node/           # Node.js WASM build (generated)
│   └── public/                 # Static frontend files
│       ├── index.html          # Student lab view
│       ├── main.js             # Student lab logic
│       ├── teacher.html        # Professor lab editor
│       ├── teacher.js
│       ├── students.html       # Student roster + grade management
│       ├── students.js
│       ├── testgen.html        # Test case generator
│       ├── testgen.js
│       ├── login.html          # Login page
│       ├── auth-check.js       # Auth guard (shared)
│       ├── style.css
│       └── pkg/                # Browser WASM build (generated)
└── .gitignore
```

---

## Full Setup Guide (From Clone to Live)

### Prerequisites

Install these before starting:

- **Rust toolchain**: https://rustup.rs
- **wasm-pack**: `cargo install wasm-pack`
- **Python 3.9+**: https://python.org
- **Node.js 18+**: https://nodejs.org
- **Vercel CLI**: `npm install -g vercel`

### Step 1 - Clone the Repository

```bash
git clone https://github.com/StrikerFultz/CSE230CapstoneProject1.git
cd CSE230CapstoneProject1
git checkout vercel
```

### Step 2 - Set Up Neon Database

1. Go to https://neon.tech and create a free account
2. Click **New Project** and create a project (e.g. `mips-emulator`)
3. Copy the **pooled connection string**:
   ```
   postgresql://YOUR_URL
   ```
4. Run the schema. Either paste `schema.sql` into Neon's **SQL Editor** in the dashboard, or run:
   ```bash
   psql "YOUR_CONNECTION_STRING" -f schema.sql
   ```

### Step 3 - Create Environment File

Create a `.env` file in the **repo root**:

```bash
DATABASE_URL=postgresql://neondb_owner:YOUR_PASS@ep-xxx.neon.tech/neondb?sslmode=require
FLASK_SECRET_KEY=your-secret-key-here
EMULATOR_URL=http://localhost:3000/api/emulator
```

Generate a secret key with:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Step 4 - Seed the Database with Labs

```bash
pip install psycopg2-binary python-dotenv
python migrate_labs.py
```

This populates the database with all labs, test cases, starter code, and solution code from `labs_curriculum.json`.

To add or update individual labs without re-running the full migration, use the Professor View in the app. The migration script uses `ON CONFLICT DO UPDATE` so it is safe to re-run at any time. It will not duplicate data.

### Step 5 - Create the First Instructor Account

After seeding, register an account through the app's signup page using an ASURITE that exists in the course roster, then manually promote it to instructor via SQL:

```sql
UPDATE users SET role = 'instructor' WHERE username = 'your_asurite';
```

Subsequent instructor or TA accounts can be promoted the same way. Students who sign up with an ASURITE on the course roster are automatically assigned the `student` role.

### Step 6 - Build WASM Packages

You need two separate WASM builds from the Rust source:

```bash
# Browser WASM (for the frontend emulator UI)
wasm-pack build --target web --release --out-dir deploy/public/pkg

# Node.js WASM (for the server-side autograder)
wasm-pack build --target nodejs --release --out-dir deploy/api/pkg-node
```

Verify both builds exist:
```bash
ls deploy/public/pkg/mips_emu_wasm_bg.wasm
ls deploy/api/pkg-node/mips_emu_wasm_bg.wasm
```

### Step 7 - Set Up Vercel

```bash
# Log in to Vercel
vercel login

# Link the deploy directory to a Vercel project
cd deploy
vercel link
```

When prompted:
- **Set up?** → Y
- **Link to existing project?** → N (first time) or Y (if re-linking)
- **Project name** → `mips-emulator` (or your preferred name)

### Step 8 - Set Vercel Environment Variables

```bash
vercel env add DATABASE_URL
# Paste your Neon connection string, select all environments

vercel env add FLASK_SECRET_KEY
# Paste your generated secret key, select all environments

vercel env add EMULATOR_URL
# Paste: https://YOUR-PROJECT.vercel.app/api/emulator
# Select all environments
```

### Step 9 - Deploy

```bash
vercel --prod
```

Your app is now live at the URL Vercel provides (e.g. `https://mips-emulator.vercel.app`).

---

## Transferring Labs to a New Instance

Labs are stored in two places: the `labs_curriculum.json` file (source of truth for seeding) and the Neon database. To transfer labs to a new deployment:

**Option A - Re-run the migration script** against the new database. This is the recommended approach if you have an up-to-date `labs_curriculum.json`.

**Option B - Export from the Professor View**. Each lab can be exported individually as a `.lesson.json` file via the Export button in the Professor View, then imported into the new instance using the Import button. This captures the lab HTML, starter code, and solution code but not test cases. Test cases must be re-entered or migrated via SQL.

**Option C - Direct database copy** using Neon's branching or `pg_dump`:
```bash
pg_dump "SOURCE_CONNECTION_STRING" --table=labs --table=lab_test_cases > labs_export.sql
psql "TARGET_CONNECTION_STRING" -f labs_export.sql
```

---

## Ongoing Development

### After Rust Code Changes

```bash
# From repo root (where Cargo.toml is)
wasm-pack build --target web --release --out-dir deploy/public/pkg
wasm-pack build --target nodejs --release --out-dir deploy/api/pkg-node

cd deploy
vercel --prod
```

### After Web Code Changes (HTML/CSS/JS/Python)

```bash
# Edit files directly in deploy/public/ or deploy/api/
cd deploy
vercel --prod
```

### If Connected to GitHub

After connecting the repo in the Vercel dashboard (Settings → Git), just push:

```bash
git add .
git commit -m "description of change"
git push
```

Vercel auto-deploys on every push to the production branch.

---

## Contributions

Thanks to the members of ASU Capstone I/II from Fall 2025 to Spring 2026:

**Team Members**:
* Angel: Scrum Master
* Kailey
* Matthew
* Ethan

**Additional Members**:
* Paul
* Jenna