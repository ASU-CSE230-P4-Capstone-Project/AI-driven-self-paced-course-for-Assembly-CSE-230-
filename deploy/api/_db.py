import os
import logging
import psycopg2

log = logging.getLogger(__name__)


def _build_dsn() -> str:
    """Return a connection string, preferring DATABASE_URL if set."""
    url = os.environ.get('DATABASE_URL')
    if url:
        return url

    return (
        f"dbname={os.environ.get('DB_NAME', 'capstone')} "
        f"user={os.environ.get('DB_USER', 'postgres')} "
        f"password={os.environ.get('DB_PASSWORD', '')} "
        f"host={os.environ.get('DB_HOST', 'localhost')} "
        f"port={os.environ.get('DB_PORT', '5432')} "
        f"sslmode={os.environ.get('DB_SSLMODE', 'require')}"
    )


def get_db_connection():
    """Open a new psycopg2 connection.

    Serverless note: every invocation may open its own connection.
    Neon's built-in connection pooler keeps this efficient.
    Use the *pooled* endpoint (port 5432) in your DATABASE_URL.
    """
    try:
        conn = psycopg2.connect(_build_dsn())
        return conn
    except psycopg2.Error as e:
        log.error("Database connection error: %s", e)
        return None
