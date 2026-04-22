import json
import psycopg2
import os
from psycopg2.extras import RealDictCursor

from dotenv import load_dotenv
load_dotenv()

DB_URL = os.environ.get('DATABASE_URL')

def get_connection():
    if DB_URL:
        return psycopg2.connect(DB_URL)
    return psycopg2.connect(**DB_CONFIG)

DB_CONFIG = {
    'dbname':   os.environ.get('DB_NAME', 'capstone'),
    'user':     os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'host':     os.environ.get('DB_HOST', 'localhost'),
    'port':     os.environ.get('DB_PORT', '5432'),
}

def seed_database():
    try:
        with open('labs_curriculum.json', 'r') as f:
            curriculum = json.load(f)
        print(f"Successfully loaded {len(curriculum)} labs from JSON.")
    except FileNotFoundError:
        print("Error: 'labs_curriculum.json' not found in the current directory.")
        return

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT course_id FROM courses LIMIT 1")
        course = cur.fetchone()
        if not course:
            cur.execute("""
                INSERT INTO courses (course_code, course_name, semester, year, is_active)
                VALUES ('CSE101', 'Intro to MIPS', 'Spring', 2026, TRUE)
                RETURNING course_id
            """)
            course_id = cur.fetchone()[0]
        else:
            course_id = course[0]

        for lab_id, data in curriculum.items():
            print(f"Processing {lab_id}...")
            
            use_iso = data.get('use_isolation', False)

            cur.execute("""
                INSERT INTO labs (
                    lab_id, course_id, title, description, instructions, 
                    starter_code, solution_code, difficulty, total_points, 
                    is_published, use_isolation
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s)
                ON CONFLICT (lab_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    instructions = EXCLUDED.instructions,
                    starter_code = EXCLUDED.starter_code,
                    solution_code = EXCLUDED.solution_code,
                    difficulty = EXCLUDED.difficulty,
                    total_points = EXCLUDED.total_points,
                    is_published = TRUE,
                    use_isolation = EXCLUDED.use_isolation;
            """, (
                lab_id, 
                course_id, 
                data['title'], 
                data.get('description'), 
                data['html'], 
                data.get('starter_code'), 
                data.get('solution_code'),
                data.get('difficulty', 'beginner'),
                data.get('points', 100),
                use_iso
            ))

            cur.execute("DELETE FROM lab_test_cases WHERE lab_id = %s", (lab_id,))
            
            if 'testCases' in data:
                for tc in data['testCases']:
                    input_data = json.dumps({
                        "registers": tc.get("initialRegisters", {}),
                        "memory": tc.get("initialMemory", {})
                    })
                    expected_output = json.dumps({
                        "registers": tc.get("expectedRegisters", {}),
                        "memory": tc.get("expectedMemory", {})
                    })

                    cur.execute("""
                        INSERT INTO lab_test_cases (
                            lab_id, test_name, test_type, description, 
                            points, is_hidden, timeout_seconds, 
                            input_data, expected_output
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        lab_id, 
                        tc['name'], 
                        tc.get('test_type', 'register'),
                        tc.get('description'),
                        tc['points'], 
                        tc.get('is_hidden', False),
                        tc.get('timeout_seconds', 5),
                        input_data, 
                        expected_output
                    ))

        conn.commit()
        print("\n--- TRANSACTION COMMITTED ---")

        cur.execute("SELECT COUNT(*) FROM labs")
        lab_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM lab_test_cases")
        tc_count = cur.fetchone()[0]
        print(f"Verification: {lab_count} labs and {tc_count} test cases are now in the DB.")

    except Exception as e:
        conn.rollback()
        print(f"FATAL ERROR: {e}")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    seed_database()