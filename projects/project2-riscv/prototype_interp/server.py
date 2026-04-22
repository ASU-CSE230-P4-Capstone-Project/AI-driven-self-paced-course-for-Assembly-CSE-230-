"""
Our flask router for running the backend
and sending it out.
"""

import json
import os
from pathlib import Path

import psycopg2
from flask import Flask, request, jsonify

from stringParse import sourceToInstructions, preprocessAssemblyForEmulator
from runtime import Runtime
from machine import MachineState

app = Flask(__name__)

# Grade attempt limits (server-side; persisted in DB)
GRADE_LIMIT = 5

def load_local_env() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)

def get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value

load_local_env()

# Database connection helper
def get_db_connection():
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url:
        return psycopg2.connect(url)

    db_port_raw = get_required_env("DB_PORT")
    try:
        db_port = int(db_port_raw)
    except ValueError as exc:
        raise RuntimeError(f"Invalid DB_PORT value: {db_port_raw}") from exc

    return psycopg2.connect(
        host=get_required_env("DB_HOST"),
        database=get_required_env("DB_NAME"),
        user=get_required_env("DB_USER"),
        password=get_required_env("DB_PASSWORD"),
        port=db_port,
    )

def constraint_exists(cur, name: str) -> bool:
    cur.execute("SELECT 1 FROM pg_constraint WHERE conname = %s", (name,))
    return cur.fetchone() is not None

def ensure_grade_attempt_tables(cur):
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS grade_attempts (
            username TEXT NOT NULL,
            lab_uid TEXT NOT NULL,
            attempts_used INTEGER NOT NULL DEFAULT 0,
            updated_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (username, lab_uid)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS grade_attempt_sessions (
            username TEXT NOT NULL,
            lab_uid TEXT NOT NULL,
            grade_session_id TEXT NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (username, lab_uid, grade_session_id)
        )
        """
    )

    if not constraint_exists(cur, "grade_attempts_username_fkey"):
        cur.execute(
            """
            ALTER TABLE ONLY grade_attempts
                ADD CONSTRAINT grade_attempts_username_fkey
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            """
        )
    if not constraint_exists(cur, "grade_attempts_lab_fkey"):
        cur.execute(
            """
            ALTER TABLE ONLY grade_attempts
                ADD CONSTRAINT grade_attempts_lab_fkey
                FOREIGN KEY (lab_uid) REFERENCES labs(uid) ON DELETE CASCADE
            """
        )
    if not constraint_exists(cur, "grade_attempt_sessions_username_fkey"):
        cur.execute(
            """
            ALTER TABLE ONLY grade_attempt_sessions
                ADD CONSTRAINT grade_attempt_sessions_username_fkey
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            """
        )
    if not constraint_exists(cur, "grade_attempt_sessions_lab_fkey"):
        cur.execute(
            """
            ALTER TABLE ONLY grade_attempt_sessions
                ADD CONSTRAINT grade_attempt_sessions_lab_fkey
                FOREIGN KEY (lab_uid) REFERENCES labs(uid) ON DELETE CASCADE
            """
        )

    # Persist per-test-case pass/fail for each grade session.
    # This lets instructors compute final scores + show which test cases passed.
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS grade_test_case_results (
            username TEXT NOT NULL,
            lab_uid TEXT NOT NULL,
            grade_session_id TEXT NOT NULL,
            test_uid TEXT NOT NULL,
            pass BOOLEAN NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (username, lab_uid, grade_session_id, test_uid)
        )
        """
    )

def lock_attempt_row(cur, username: str, lab_uid: str) -> int:
    cur.execute(
        "SELECT attempts_used FROM grade_attempts WHERE username = %s AND lab_uid = %s FOR UPDATE",
        (username, lab_uid),
    )
    row = cur.fetchone()
    if row is None:
        cur.execute(
            """
            INSERT INTO grade_attempts (username, lab_uid, attempts_used)
            VALUES (%s, %s, 0)
            ON CONFLICT (username, lab_uid) DO NOTHING
            """,
            (username, lab_uid),
        )
        cur.execute(
            "SELECT attempts_used FROM grade_attempts WHERE username = %s AND lab_uid = %s FOR UPDATE",
            (username, lab_uid),
        )
        row = cur.fetchone()
    return int(row[0]) if row else 0

def ensure_course_grade_attempt_tables(cur):
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS course_grade_attempts (
            username TEXT NOT NULL,
            course_id CHAR(5) NOT NULL,
            lab_uid TEXT NOT NULL,
            attempts_used INTEGER NOT NULL DEFAULT 0,
            updated_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (username, course_id, lab_uid)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS course_grade_attempt_sessions (
            username TEXT NOT NULL,
            course_id CHAR(5) NOT NULL,
            lab_uid TEXT NOT NULL,
            grade_session_id TEXT NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (username, course_id, lab_uid, grade_session_id)
        )
        """
    )

    if not constraint_exists(cur, "course_grade_attempts_username_fkey"):
        cur.execute(
            """
            ALTER TABLE ONLY course_grade_attempts
                ADD CONSTRAINT course_grade_attempts_username_fkey
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            """
        )
    if not constraint_exists(cur, "course_grade_attempts_course_lab_fkey"):
        cur.execute(
            """
            ALTER TABLE ONLY course_grade_attempts
                ADD CONSTRAINT course_grade_attempts_course_lab_fkey
                FOREIGN KEY (course_id, lab_uid)
                REFERENCES course_labs(course_id, lab_uid)
                ON DELETE CASCADE
            """
        )
    if not constraint_exists(cur, "course_grade_attempt_sessions_username_fkey"):
        cur.execute(
            """
            ALTER TABLE ONLY course_grade_attempt_sessions
                ADD CONSTRAINT course_grade_attempt_sessions_username_fkey
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            """
        )
    if not constraint_exists(cur, "course_grade_attempt_sessions_course_lab_fkey"):
        cur.execute(
            """
            ALTER TABLE ONLY course_grade_attempt_sessions
                ADD CONSTRAINT course_grade_attempt_sessions_course_lab_fkey
                FOREIGN KEY (course_id, lab_uid)
                REFERENCES course_labs(course_id, lab_uid)
                ON DELETE CASCADE
            """
        )

def has_course_lab_access(cur, username: str, course_id: str, lab_uid: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM course_memberships cm
        JOIN course_labs cl ON cl.course_id = cm.course_id
        WHERE cm.username = %s
          AND cm.course_id = %s
          AND cm.role = 'student'
          AND cm.status = 'active'
          AND cl.lab_uid = %s
        LIMIT 1
        """,
        (username, course_id, lab_uid),
    )
    return cur.fetchone() is not None

def lock_course_attempt_row(cur, username: str, course_id: str, lab_uid: str) -> int:
    cur.execute(
        """
        SELECT attempts_used
        FROM course_grade_attempts
        WHERE username = %s AND course_id = %s AND lab_uid = %s
        FOR UPDATE
        """,
        (username, course_id, lab_uid),
    )
    row = cur.fetchone()
    if row is None:
        cur.execute(
            """
            INSERT INTO course_grade_attempts (username, course_id, lab_uid, attempts_used)
            VALUES (%s, %s, %s, 0)
            ON CONFLICT (username, course_id, lab_uid) DO NOTHING
            """,
            (username, course_id, lab_uid),
        )
        cur.execute(
            """
            SELECT attempts_used
            FROM course_grade_attempts
            WHERE username = %s AND course_id = %s AND lab_uid = %s
            FOR UPDATE
            """,
            (username, course_id, lab_uid),
        )
        row = cur.fetchone()
    return int(row[0]) if row else 0

def consume_course_attempt(cur, username: str, course_id: str, lab_uid: str, grade_session_id: str) -> tuple[bool, int]:
    attempts_used = lock_course_attempt_row(cur, username, course_id, lab_uid)

    if grade_session_id:
        cur.execute(
            """
            SELECT 1 FROM course_grade_attempt_sessions
            WHERE username = %s
              AND course_id = %s
              AND lab_uid = %s
              AND grade_session_id = %s
            """,
            (username, course_id, lab_uid, grade_session_id),
        )
        session_exists = cur.fetchone() is not None
        if session_exists:
            return True, attempts_used

        if attempts_used >= GRADE_LIMIT:
            return False, attempts_used

        cur.execute(
            """
            INSERT INTO course_grade_attempt_sessions (username, course_id, lab_uid, grade_session_id)
            VALUES (%s, %s, %s, %s)
            """,
            (username, course_id, lab_uid, grade_session_id),
        )
    else:
        if attempts_used >= GRADE_LIMIT:
            return False, attempts_used

    cur.execute(
        """
        UPDATE course_grade_attempts
        SET attempts_used = attempts_used + 1, updated_at = now()
        WHERE username = %s AND course_id = %s AND lab_uid = %s
        """,
        (username, course_id, lab_uid),
    )
    return True, attempts_used + 1

def evaluate_test_case(code: str, seed_registers_json: str, seed_memory_json: str, result_registers_json: str, result_memory_json: str) -> bool:
    seed_registers = json.loads(seed_registers_json)
    seed_memory = json.loads(seed_memory_json)
    result_registers = json.loads(result_registers_json)
    result_memory = json.loads(result_memory_json)

    processed_code, data_words = preprocessAssemblyForEmulator(code)
    initialState = MachineState()

    for addr, word_val in data_words:
        u = word_val & 0xFFFFFFFF
        if addr + 3 >= len(initialState.memory):
            continue
        initialState.memory[addr].value = u & 0xFF
        initialState.memory[addr + 1].value = (u >> 8) & 0xFF
        initialState.memory[addr + 2].value = (u >> 16) & 0xFF
        initialState.memory[addr + 3].value = (u >> 24) & 0xFF

    for reg_key, val_str in seed_registers.items():
        reg_num = int(reg_key.lower().replace('x', ''))
        if 0 <= reg_num <= 31:
            initialState.regs[reg_num].value = int(val_str, 16)

    for addr_str, val_str in seed_memory.items():
        addr = int(addr_str, 16)
        if 0 <= addr < len(initialState.memory):
            initialState.memory[addr].value = int(val_str, 16)

    instructions = sourceToInstructions(processed_code)
    runtime = Runtime(instructions, initialState)
    runtime.run()
    finalState = runtime.states[-1]

    for reg_key, expected_val_str in result_registers.items():
        reg_num = int(reg_key.lower().replace('x', ''))
        if 0 <= reg_num <= 31:
            expected_val = int(expected_val_str, 16)
            actual_val = finalState.regs[reg_num].value
            if actual_val != expected_val:
                return False

    for addr_str, expected_val_str in result_memory.items():
        addr = int(addr_str, 16)
        if 0 <= addr < len(finalState.memory):
            expected_val = int(expected_val_str, 16)
            actual_val = finalState.memory[addr].value
            if actual_val != expected_val:
                return False

    return True

def save_course_submission(cur, username: str, course_id: str, lab_uid: str, grade_session_id: str, code: str, grade: float, passed_tests: int, total_tests: int, passed: bool, error_message: str | None):
    cur.execute(
        """
        INSERT INTO course_lab_submissions (
            username,
            course_id,
            lab_uid,
            grade_session_id,
            submitted_code,
            grade,
            passed_tests,
            total_tests,
            passed,
            error_message
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (username, course_id, lab_uid, grade_session_id) DO UPDATE
        SET submitted_code = EXCLUDED.submitted_code,
            grade = EXCLUDED.grade,
            passed_tests = EXCLUDED.passed_tests,
            total_tests = EXCLUDED.total_tests,
            passed = EXCLUDED.passed,
            error_message = EXCLUDED.error_message
        """,
        (
            username,
            course_id,
            lab_uid,
            grade_session_id,
            code,
            grade,
            passed_tests,
            total_tests,
            passed,
            error_message,
        ),
    )

"""
 NEW Agreed upon JSON schema:
{
    “hadError” : True | False ← Boolean,
    
    “errorMessage” : “…” ← Can be empty if no error, or report a meaningful error message,
    
    "states" : "[
        {" ←  A list of states as an array of objects, each containing the machine state at that point
            “registers” : {
            “x0” : “0xa…” ← always hex values
            },
        
            “memory” : {
            “0x0” : “0xa” ← also always hex, key is the address, value is the value there
            }
        }
    ]
}
"""
@app.route('/data', methods=['POST'])
def data():
    """
    Will return the error response schema because its not valid JSON
    """
    if not request.is_json:
        return jsonify({
            "hadError" : True,
            "errorMessage" : "Error: Request must be valid JSON",
            "states" : [],
        })
    """
    Will check the front end request schema
    """
    try:
       jsonData = request.get_json()
       codeField = jsonData.get('code')

       if not codeField:
           return jsonify({
               "hadError": True,
               "errorMessage": "Error: No code field specified",
               "states" : [],
           })

       else:
           # Preprocess lab-style code (supports .data/.word, la/li, lw/sw offset(base))
           processed_code, data_words = preprocessAssemblyForEmulator(codeField)
           # Parse the source code into instruction objects using the modern regex-based parser
           instructions = sourceToInstructions(processed_code)
           
           # Build initial state and seed registers/memory overrides
           initialState = MachineState()

           # Seed `.data` words into memory first (request overrides can overwrite later)
           for addr, word_val in data_words:
               u = word_val & 0xFFFFFFFF
               if addr + 3 >= len(initialState.memory):
                   continue
               initialState.memory[addr].value = u & 0xFF
               initialState.memory[addr + 1].value = (u >> 8) & 0xFF
               initialState.memory[addr + 2].value = (u >> 16) & 0xFF
               initialState.memory[addr + 3].value = (u >> 24) & 0xFF

           registers = jsonData.get('registers') or {}
           memory = jsonData.get('memory') or {}

           # Seed registers (format: {"x1": "0x5", "x2": "0x10"})
           for reg_key, val_str in registers.items():
               try:
                   reg_num = int(str(reg_key).lower().replace('x', ''))
                   if 0 <= reg_num <= 31:
                       initialState.regs[reg_num].value = int(str(val_str), 16)
               except Exception:
                   continue

           # Seed memory (format: {"0x0": "0x42"}) - overrides `.data` seeding
           for addr_str, val_str in memory.items():
               try:
                   addr = int(str(addr_str), 16)
                   if 0 <= addr < len(initialState.memory):
                       initialState.memory[addr].value = int(str(val_str), 16)
               except Exception:
                   continue

           # Execute all instructions using the Runtime
           runtime = Runtime(instructions, initialState)
           runtime.run()
           
           # Get the final machine state after execution
           #finalState = runtime.states[-1]

           #Now we need every machine state in execution
           allStates = []

           for state in runtime.states:

               # Prepare output variables
               # registersJson will loop through all registers and convert to hex
               # memoryJson will get the memory pairs (addresses and values) and convert to hex
               registersJson = {f"x{r}": hex(reg.value) for r, reg in enumerate(state.regs)}
               memoryJson = {hex(mem.addr): hex(mem.value) for mem in state.memory}
               allStates.append({
                   "registers" : registersJson,
                   "memory" : memoryJson
               })

           return jsonify({
               "hadError": False,
               "errorMessage": "",
               "states" : allStates,
           })

    except Exception as e:
        return jsonify({
            "hadError": True,
            "errorMessage": "Error: " + str(e),
            "states" : [],
        })

@app.route('/score', methods=['POST'])
def score():
    """
    Scores student code against a test case.
    
    Input: { "code": str, "course_id": str, "test_uid": str, "grade_session_id": str?, "username": str }
    Output: { "pass": bool }
    
    Fetches the test case from DB, seeds the machine state,
    runs the code, and compares final state against expected results.
    """
    if not request.is_json:
        return jsonify({"pass": False, "error": "Request must be valid JSON"})
    
    conn = None
    cur = None
    try:
        jsonData = request.get_json()
        code = jsonData.get('code')
        course_id = (jsonData.get('course_id') or "").strip()
        test_uid = jsonData.get('test_uid')
        grade_session_id = (jsonData.get('grade_session_id') or "").strip()
        username = (jsonData.get('username') or "").strip()

        if not code:
            return jsonify({"pass": False, "error": "No code field specified"})
        if not course_id:
            return jsonify({"pass": False, "error": "No course_id provided"})
        if not test_uid:
            return jsonify({"pass": False, "error": "No test_uid field specified"})
        if not username:
            return jsonify({"pass": False, "error": "No username provided"})

        # Fetch test case from database
        conn = get_db_connection()
        cur = conn.cursor()
        ensure_course_grade_attempt_tables(cur)
        conn.commit()
        cur.execute(
            "SELECT lab_uid, seed_registers, seed_memory, result_registers, result_memory FROM test_cases WHERE uid = %s",
            (test_uid,)
        )
        row = cur.fetchone()

        if not row:
            return jsonify({"pass": False, "error": "Test case not found"})

        lab_uid, seed_registers_json, seed_memory_json, result_registers_json, result_memory_json = row

        if not has_course_lab_access(cur, username, course_id, lab_uid):
            conn.commit()
            return jsonify({"pass": False, "error": "Lab unavailable for this course"})

        allowed, attempts_used = consume_course_attempt(
            cur, username, course_id, lab_uid, grade_session_id
        )
        if not allowed:
            conn.commit()
            return jsonify({
                "pass": False,
                "error": "Grade limit reached",
                "attemptsUsed": attempts_used,
                "attemptsRemaining": 0,
                "attemptsLimit": GRADE_LIMIT,
            })

        conn.commit()

        passed = evaluate_test_case(
            code,
            seed_registers_json,
            seed_memory_json,
            result_registers_json,
            result_memory_json,
        )

        if grade_session_id:
            cur.execute(
                """
                INSERT INTO grade_test_case_results (username, lab_uid, grade_session_id, test_uid, pass)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (username, lab_uid, grade_session_id, test_uid)
                DO UPDATE SET
                  pass = EXCLUDED.pass,
                  created_at = now()
                """,
                (username, lab_uid, grade_session_id, test_uid, passed),
            )
            conn.commit()

        return jsonify({
            "pass": passed,
            "attemptsUsed": attempts_used,
            "attemptsRemaining": max(GRADE_LIMIT - attempts_used, 0),
            "attemptsLimit": GRADE_LIMIT,
        })
        
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return jsonify({"pass": False, "error": str(e)})
    finally:
        if cur:
            try:
                cur.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass

@app.route('/grade_lab', methods=['POST'])
def grade_lab():
    """
    Grades all test cases for a lab in one request.

    Input: { "code": str, "course_id": str, "lab_uid": str, "grade_session_id": str?, "username": str }
    Output: aggregate pass/fail, grade, attempts metadata, and optional error/saveWarning
    """
    if not request.is_json:
        return jsonify({"pass": False, "error": "Request must be valid JSON"})

    conn = None
    cur = None
    try:
        jsonData = request.get_json()
        code = jsonData.get('code')
        course_id = (jsonData.get('course_id') or "").strip()
        lab_uid = (jsonData.get('lab_uid') or "").strip()
        grade_session_id = (jsonData.get('grade_session_id') or "").strip()
        username = (jsonData.get('username') or "").strip()

        if not code:
            return jsonify({"pass": False, "error": "No code field specified"})
        if not course_id:
            return jsonify({"pass": False, "error": "No course_id provided"})
        if not lab_uid:
            return jsonify({"pass": False, "error": "No lab_uid provided"})
        if not username:
            return jsonify({"pass": False, "error": "No username provided"})

        conn = get_db_connection()
        cur = conn.cursor()
        ensure_course_grade_attempt_tables(cur)
        conn.commit()

        if not has_course_lab_access(cur, username, course_id, lab_uid):
            return jsonify({"pass": False, "error": "Lab unavailable for this course"})

        cur.execute(
            """
            SELECT uid, name, seed_registers, seed_memory, result_registers, result_memory
            FROM test_cases
            WHERE lab_uid = %s
            ORDER BY name ASC, uid ASC
            """,
            (lab_uid,),
        )
        test_rows = cur.fetchall()

        if not test_rows:
            return jsonify({"pass": False, "error": "No test cases configured for this lab"})

        allowed, attempts_used = consume_course_attempt(
            cur, username, course_id, lab_uid, grade_session_id
        )
        if not allowed:
            conn.commit()
            return jsonify({
                "pass": False,
                "error": "Grade limit reached",
                "attemptsUsed": attempts_used,
                "attemptsRemaining": 0,
                "attemptsLimit": GRADE_LIMIT,
            })

        conn.commit()

        total_tests = len(test_rows)
        passed_tests = 0
        submission_error = None
        save_warning = None

        try:
            for _, _, seed_registers_json, seed_memory_json, result_registers_json, result_memory_json in test_rows:
                if evaluate_test_case(
                    code,
                    seed_registers_json,
                    seed_memory_json,
                    result_registers_json,
                    result_memory_json,
                ):
                    passed_tests += 1
        except Exception as exc:
            submission_error = str(exc)

        passed_all = submission_error is None and passed_tests == total_tests
        grade = round((passed_tests / total_tests) * 100, 2)

        if grade_session_id:
            try:
                save_course_submission(
                    cur,
                    username,
                    course_id,
                    lab_uid,
                    grade_session_id,
                    code,
                    grade,
                    passed_tests,
                    total_tests,
                    passed_all,
                    submission_error,
                )
                conn.commit()
            except Exception as save_exc:
                try:
                    conn.rollback()
                except Exception:
                    pass
                save_warning = f"Submission history was not saved: {save_exc}"
        else:
            save_warning = "Submission history was not saved because grade_session_id was missing."

        response = {
            "pass": passed_all,
            "grade": grade,
            "passedTests": passed_tests,
            "totalTests": total_tests,
            "attemptsUsed": attempts_used,
            "attemptsRemaining": max(GRADE_LIMIT - attempts_used, 0),
            "attemptsLimit": GRADE_LIMIT,
        }
        if submission_error:
            response["error"] = submission_error
        if save_warning:
            response["saveWarning"] = save_warning
        return jsonify(response)
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return jsonify({"pass": False, "error": str(e)})
    finally:
        if cur:
            try:
                cur.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass

@app.route('/grade_status', methods=['POST'])
def grade_status():
    """
    Returns remaining grade attempts for a lab in a course (server-side).
    Input: { "course_id": str, "lab_uid": str, "username": str }
    Output: { "attemptsUsed": int, "attemptsRemaining": int, "attemptsLimit": int }
    """
    if not request.is_json:
        return jsonify({"error": "Request must be valid JSON"})

    jsonData = request.get_json()
    course_id = (jsonData.get('course_id') or "").strip()
    lab_uid = (jsonData.get('lab_uid') or "").strip()
    username = (jsonData.get('username') or "").strip()
    if not course_id:
        return jsonify({"error": "No course_id provided"})
    if not lab_uid:
        return jsonify({"error": "No lab_uid field specified"})
    if not username:
        return jsonify({"error": "No username provided"})

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        ensure_course_grade_attempt_tables(cur)
        conn.commit()
        if not has_course_lab_access(cur, username, course_id, lab_uid):
            return jsonify({"error": "Lab unavailable for this course"})
        cur.execute(
            """
            SELECT attempts_used
            FROM course_grade_attempts
            WHERE username = %s AND course_id = %s AND lab_uid = %s
            """,
            (username, course_id, lab_uid),
        )
        row = cur.fetchone()
        attempts_used = int(row[0]) if row else 0

        return jsonify({
            "attemptsUsed": attempts_used,
            "attemptsRemaining": max(GRADE_LIMIT - attempts_used, 0),
            "attemptsLimit": GRADE_LIMIT,
        })
    finally:
        if cur:
            try:
                cur.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass

if __name__ == '__main__':
    port = int(os.environ.get("PORT", "25565"))
    debug = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    app.run(host="0.0.0.0", debug=debug, port=port)
