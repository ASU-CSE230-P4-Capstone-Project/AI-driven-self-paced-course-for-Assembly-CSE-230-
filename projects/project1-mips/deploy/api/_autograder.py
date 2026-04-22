import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import os
import json
import logging
import requests
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Blueprint, request, jsonify, session

from _db import get_db_connection

log = logging.getLogger(__name__)

simple_autograder_bp = Blueprint('simple_autograder', __name__, url_prefix='/api/grade')

MAX_SUBMISSIONS = 5

def _emulator_url():
    override = os.environ.get('EMULATOR_URL')
    if override:
        return override
    vercel_url = os.environ.get('VERCEL_URL', 'localhost:3000')
    protocol = 'https' if 'vercel' in vercel_url else 'http'
    return f"{protocol}://{vercel_url}/api/emulator"


def _strip_expected_for_student(results_list):
    sanitized = []
    for test in results_list:
        t = dict(test)
        if 'mismatches' in t and t['mismatches']:
            t['mismatches'] = [
                {'register': m['register'], 'actual': m['actual']}
                for m in t['mismatches']
            ]
        sanitized.append(t)
    return sanitized


def run_mips_via_wasm(source_code, initial_registers=None,
                      initial_memory=None, check_memory=None, use_isolation=False):
    """
    Run student code by POSTing to the Node.js /api/emulator endpoint.
    This replaces the old subprocess.run(GRADER_BINARY, ...) call.
    """
    payload = {
        'source_code':       source_code,
        'initial_registers': initial_registers or {},
        'initial_memory':    initial_memory or {},
        'check_memory':      check_memory or [],
        'use_isolation':     use_isolation,
    }

    try:
        resp = requests.post(
            _emulator_url(),
            json=payload,
            timeout=15,
        )

        if resp.status_code != 200:
            return {
                'error': f'Emulator returned HTTP {resp.status_code}: {resp.text[:200]}',
                'registers': {},
                'memory': {},
            }

        return resp.json()

    except requests.Timeout:
        return {'error': 'Emulator timed out', 'registers': {}, 'memory': {}}
    except Exception as e:
        log.error("Emulator call failed: %s", e, exc_info=True)
        return {'error': 'Emulator execution failed', 'registers': {}, 'memory': {}}


def calculate_grade(test_cases, source_code, use_isolation=False):
    """Grade by running source code against each test case via the WASM endpoint."""

    total_points = 0
    earned_points = 0
    passed = 0
    failed = 0
    results = []

    for test in test_cases:
        test_name = test.get('name', 'Test')
        points    = test.get('points', 10)

        initial_regs = test.get('initial_registers', {})
        initial_mem  = test.get('initial_memory', {})
        expected_regs = test.get('expected_registers', {})
        expected_mem  = test.get('expected_memory', {})

        total_points += points

        check_memory = [int(addr) for addr in expected_mem.keys()] if expected_mem else []

        run_result = run_mips_via_wasm(
            source_code,
            initial_registers=initial_regs,
            initial_memory=initial_mem,
            check_memory=check_memory,
            use_isolation=use_isolation, # Pass the flag here
        )

        if run_result.get('error'):
            failed += 1
            results.append({
                'name': test_name, 'status': 'ERROR', 'points': points,
                'earned': 0, 'message': f'Runtime error: {run_result["error"]}'
            })
            continue

        student_registers = run_result.get('registers', {})
        student_memory    = run_result.get('memory', {})

        all_correct = True
        mismatches = []

        for register, expected_value in expected_regs.items():
            student_value = student_registers.get(register)
            if student_value != expected_value:
                all_correct = False
                mismatches.append({
                    'register': register,
                    'expected': expected_value,
                    'actual':   student_value,
                })

        for addr_str, expected_value in expected_mem.items():
            student_value = student_memory.get(str(addr_str))
            if student_value != expected_value:
                all_correct = False
                mismatches.append({
                    'register': f'mem[{addr_str}]',
                    'expected': expected_value,
                    'actual':   student_value,
                })

        if all_correct:
            earned_points += points
            passed += 1
            results.append({
                'name': test_name, 'status': 'PASS', 'points': points,
                'earned': points, 'message': 'All checks passed!'
            })
        else:
            failed += 1
            results.append({
                'name': test_name, 'status': 'FAIL', 'points': points,
                'earned': 0, 'message': 'Some values incorrect',
                'mismatches': mismatches,
            })

    percentage = (earned_points / total_points * 100) if total_points > 0 else 0

    return {
        'earned_points': earned_points,
        'total_points':  total_points,
        'percentage':    round(percentage, 1),
        'passed':        passed,
        'failed':        failed,
        'results':       results,
    }


def get_test_cases_for_lab(lab_id):
    """Fetch test cases from DB and normalise for calculate_grade()."""
    conn = get_db_connection()
    if not conn:
        return None
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT test_name, description, input_data, expected_output,
                   points, is_hidden
            FROM lab_test_cases
            WHERE lab_id = %s ORDER BY test_name
        """, (lab_id,))
        rows = cursor.fetchall()

        if not rows:
            return None

        result = []
        for tc in rows:
            inp = tc.get('input_data') or {}
            exp = tc.get('expected_output') or {}
            if isinstance(inp, str): inp = json.loads(inp)
            if isinstance(exp, str): exp = json.loads(exp)

            result.append({
                'name':               tc['test_name'],
                'description':        tc.get('description'),
                'points':             tc.get('points', 10),
                'initial_registers':  inp.get('registers', {}),
                'initial_memory':     inp.get('memory', {}),
                'expected_registers': exp.get('registers', {}),
                'expected_memory':    exp.get('memory', {}),
                'is_hidden':          tc.get('is_hidden', False),
            })
        return result

    except Exception as e:
        log.error("DB error fetching test cases for %s: %s", lab_id, e, exc_info=True)
        return None
    finally:
        conn.close()


def get_submission_count(user_id, lab_id):
    conn = get_db_connection()
    if not conn:
        return 0
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM submissions WHERE user_id = %s AND lab_id = %s",
                    (user_id, lab_id))
        return int(cur.fetchone()[0])
    except Exception as e:
        log.error("Error fetching submission count: %s", e, exc_info=True)
        return 0
    finally:
        conn.close()


# API routes

@simple_autograder_bp.route('/submit', methods=['POST'])
def grade_submission():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        data = request.get_json()
        lab_id      = data.get('lab_id')
        source_code = data.get('source_code', '')

        duration_seconds = data.get('duration_seconds')
        run_count        = data.get('run_count', 0)
        started_at       = data.get('started_at')
        timing_flagged   = False

        if duration_seconds is not None:
            try:
                duration_seconds = max(0, min(int(duration_seconds), 86400))
            except (ValueError, TypeError):
                duration_seconds = None
                timing_flagged = True

        if run_count is not None:
            try:
                run_count = max(0, min(int(run_count), 10000))
            except (ValueError, TypeError):
                run_count = 0
                timing_flagged = True

        if started_at:
            try:
                client_start = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)
                server_elapsed = (now - client_start).total_seconds()
                if server_elapsed < -30:
                    timing_flagged = True
                    started_at = None
                    duration_seconds = None
                elif duration_seconds is not None and abs(server_elapsed - duration_seconds) > 60:
                    duration_seconds = int(server_elapsed)
                    timing_flagged = True
            except (ValueError, TypeError):
                started_at = None
                timing_flagged = True

        role = session.get('role', 'student')
        is_teacher = role in ('instructor', 'ta')

        submission_count = get_submission_count(session['user_id'], lab_id)
        if not is_teacher and submission_count >= MAX_SUBMISSIONS:
            return jsonify({
                'error': f'Submission limit reached. You have used all {MAX_SUBMISSIONS} attempts for this lab.',
                'attempts_used': submission_count,
                'attempts_allowed': MAX_SUBMISSIONS,
                'limit_reached': True,
            }), 403

        test_cases = get_test_cases_for_lab(lab_id)

        conn = get_db_connection()
        cur = conn.cursor()

        # Before calling calculate_grade, fetch the lab configuration
        cur.execute("SELECT use_isolation FROM labs WHERE lab_id = %s", (lab_id,))
        lab_config = cur.fetchone()
        use_isolation = lab_config[0] if lab_config else False

        grade_report = calculate_grade(test_cases, source_code, use_isolation=use_isolation)

        # Save to DB
        normalized_source = source_code.strip().replace('\n', '\\n')

        cur.execute("""
            INSERT INTO submissions
                (user_id, asurite_id, lab_id, score, total_possible,
                 source_code, test_results, duration_seconds, run_count,
                 started_at, timing_flagged)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            session['user_id'], session.get('username'), lab_id,
            grade_report['earned_points'], grade_report['total_points'],
            normalized_source, json.dumps(grade_report['results']),
            duration_seconds, run_count, started_at, timing_flagged,
        ))
        conn.commit()
        conn.close()

        new_count = submission_count + 1

        if not is_teacher:
            grade_report['results'] = _strip_expected_for_student(grade_report['results'])

        return jsonify({
            'success': True,
            'lab_id': lab_id,
            'grade_report': grade_report,
            'attempts_used': new_count,
            'attempts_remaining': None if is_teacher else max(0, MAX_SUBMISSIONS - new_count),
            'attempts_allowed':   None if is_teacher else MAX_SUBMISSIONS,
            'limit_reached':      False if is_teacher else new_count >= MAX_SUBMISSIONS,
            'unlimited':          is_teacher,
        })

    except Exception as e:
        log.error('Submit error: %s', e, exc_info=True)
        return jsonify({'error': 'Grading failed — please try again'}), 500


@simple_autograder_bp.route('/log-run', methods=['POST'])
def log_run():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    lab_id = data.get('lab_id')
    source_code = (data.get('source_code') or '').strip().replace('\n', '\\n')
    is_step = data.get('is_step', False)

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO run_telemetry (user_id, lab_id, source_code, is_step)
            VALUES (%s, %s, %s, %s)
        """, (session['user_id'], lab_id, source_code, is_step))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        log.error("Telemetry error: %s", e)
        return jsonify({'error': 'Failed to log run'}), 500
    finally:
        conn.close()


@simple_autograder_bp.route('/attempts/<lab_id>', methods=['GET'])
def get_attempts(lab_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    role = session.get('role', 'student')
    is_teacher = role in ('instructor', 'ta')
    count = get_submission_count(session['user_id'], lab_id)

    if is_teacher:
        return jsonify({
            'lab_id': lab_id, 'attempts_used': count,
            'attempts_remaining': None, 'attempts_allowed': None,
            'limit_reached': False, 'unlimited': True,
        })

    return jsonify({
        'lab_id': lab_id, 'attempts_used': count,
        'attempts_remaining': max(0, MAX_SUBMISSIONS - count),
        'attempts_allowed': MAX_SUBMISSIONS,
        'limit_reached': count >= MAX_SUBMISSIONS,
    })


@simple_autograder_bp.route('/attempts/<lab_id>/<user_id>', methods=['DELETE'])
def reset_attempts(lab_id, user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    if session.get('role', 'student') != 'instructor':
        return jsonify({'error': 'Unauthorized — instructors only'}), 403

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM submissions WHERE user_id = %s AND lab_id = %s",
                    (user_id, lab_id))
        deleted = cur.rowcount
        conn.commit()
        return jsonify({'success': True, 'lab_id': lab_id,
                        'user_id': user_id, 'deleted_count': deleted})
    except Exception as e:
        log.error('Reset error: %s', e, exc_info=True)
        return jsonify({'error': 'Failed to reset attempts'}), 500
    finally:
        conn.close()


@simple_autograder_bp.route('/test-cases/<lab_id>', methods=['GET'])
def get_test_cases_endpoint(lab_id):
    test_cases = get_test_cases_for_lab(lab_id)
    if not test_cases:
        return jsonify({'error': f'No test cases found for {lab_id}'}), 404

    sanitized = [{'name': t.get('name'), 'description': t.get('description'),
                  'points': t.get('points')} for t in test_cases]

    return jsonify({'lab_id': lab_id, 'test_cases': sanitized})


@simple_autograder_bp.route('/verify/<lab_id>', methods=['POST'])
def verify_solution(lab_id):
    """Run code against a lab's test cases without saving a submission. Instructor only."""
    role = session.get('role', '')
    if role not in ('instructor', 'ta'):
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    source_code = (data.get('source_code') or '').strip()
    if not source_code:
        return jsonify({'error': 'No source code provided'}), 400

    test_cases = get_test_cases_for_lab(lab_id)
    if not test_cases:
        return jsonify({'error': f'No test cases found for {lab_id}'}), 404

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT use_isolation FROM labs WHERE lab_id = %s", (lab_id,))
        lab_config = cur.fetchone()
        use_isolation = lab_config[0] if lab_config else False
    except Exception as e:
        log.error('verify_solution db error: %s', e, exc_info=True)
        use_isolation = False
    finally:
        conn.close()

    try:
        grade_report = calculate_grade(test_cases, source_code, use_isolation=use_isolation)
        return jsonify({'success': True, 'lab_id': lab_id, 'grade_report': grade_report})
    except Exception as e:
        log.error('verify_solution grading error: %s', e, exc_info=True)
        return jsonify({'error': 'Grading failed'}), 500


@simple_autograder_bp.route('/latest/<lab_id>', methods=['GET'])
def get_latest_submission(lab_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT score, total_possible, test_results, submitted_at, source_code
            FROM submissions
            WHERE user_id = %s AND lab_id = %s
            ORDER BY submitted_at DESC LIMIT 1
        """, (session['user_id'], lab_id))

        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'No submissions found'}), 404

        test_results = row['test_results']
        role = session.get('role', 'student')
        if role not in ('instructor', 'ta'):
            if isinstance(test_results, str):
                test_results = json.loads(test_results)
            if isinstance(test_results, list):
                test_results = _strip_expected_for_student(test_results)

        return jsonify({
            'score':          row['score'],
            'total_possible': row['total_possible'],
            'test_results':   test_results,
            'submitted_at':   row['submitted_at'].isoformat(),
            'source_code':    row['source_code'],
        })
    finally:
        conn.close()