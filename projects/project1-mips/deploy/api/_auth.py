import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import logging
from psycopg2.extras import RealDictCursor
from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

from _db import get_db_connection

log = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()

    asurite  = (data.get('asurite')   or '').strip().lower()
    email    = (data.get('email')     or '').strip().lower()
    full_name = (data.get('full_name') or '').strip()
    asu_id   = (data.get('asu_id')    or '').strip()
    password = data.get('password', '')

    if not asurite or not email or not full_name or not password:
        return jsonify({'error': 'All fields are required'}), 400
    if not email.endswith('@asu.edu'):
        return jsonify({'error': 'Must use an @asu.edu email address'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT roster_id, full_name AS roster_name FROM course_roster
            WHERE asurite = %s AND (asu_id = %s OR %s = '')
            LIMIT 1
        """, (asurite, asu_id, asu_id))
        roster_entry = cursor.fetchone()

        if not roster_entry:
            return jsonify({'error': 'You are not on the course roster. Contact your instructor if you believe this is an error.'}), 403

        cursor.execute("""
            INSERT INTO users (username, email, full_name, asu_id, password_hash, role)
            VALUES (%s, %s, %s, %s, %s, 'student')
            RETURNING user_id, username, email, full_name, asu_id, role
        """, (asurite, email, full_name, asu_id, generate_password_hash(password)))

        user = cursor.fetchone()

        cursor.execute("""
            UPDATE course_roster SET is_registered = true WHERE asurite = %s
        """, (asurite,))

        conn.commit()

        session['user_id']  = str(user['user_id'])
        session['username'] = user['username']
        session['role']     = user['role']

        return jsonify({
            'message': 'Account created successfully',
            'user': {
                'user_id':   str(user['user_id']),
                'username':  user['username'],
                'email':     user['email'],
                'full_name': user['full_name'],
                'asu_id':    user['asu_id'],
                'role':      user['role'],
            }
        }), 201

    except Exception as e:
        conn.rollback()
        err = str(e)
        if 'username' in err:
            msg = 'ASURITE already registered'
        elif 'email' in err:
            msg = 'Email already registered'
        else:
            msg = 'Account already exists'
        return jsonify({'error': msg}), 409
    finally:
        conn.close()


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = (data.get('username') or '').strip().lower()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT user_id, username, email, full_name, asu_id,
                   password_hash, role, is_active
            FROM users WHERE username = %s
        """, (username,))
        user = cursor.fetchone()

        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({'error': 'Invalid username or password'}), 401

        if not user.get('is_active', True):
            return jsonify({'error': 'Account is deactivated'}), 403

        cursor.execute("UPDATE users SET last_login = %s WHERE user_id = %s",
                       (datetime.utcnow(), user['user_id']))
        conn.commit()

        session['user_id']  = str(user['user_id'])
        session['username'] = user['username']
        session['role']     = user['role']

        return jsonify({
            'message': 'Login successful',
            'user': {
                'user_id':   str(user['user_id']),
                'username':  user['username'],
                'email':     user['email'],
                'full_name': user.get('full_name', ''),
                'asu_id':    user.get('asu_id', ''),
                'role':      user['role'],
            }
        })
    except Exception as e:
        log.error("Login error: %s", e, exc_info=True)
        return jsonify({'error': 'Login failed'}), 500
    finally:
        conn.close()


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})


@auth_bp.route('/me', methods=['GET'])
def me():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT user_id, username, email, full_name, asu_id, role, is_active
            FROM users WHERE user_id = %s
        """, (session['user_id'],))
        user = cursor.fetchone()

        if not user:
            session.clear()
            return jsonify({'error': 'User not found'}), 401

        return jsonify({
            'user': {
                'user_id':   str(user['user_id']),
                'username':  user['username'],
                'email':     user['email'],
                'full_name': user.get('full_name', ''),
                'asu_id':    user.get('asu_id', ''),
                'role':      user['role'],
            }
        })
    except Exception as e:
        log.error("Error in /me: %s", e, exc_info=True)
        return jsonify({'error': 'Failed to load user'}), 500
    finally:
        conn.close()