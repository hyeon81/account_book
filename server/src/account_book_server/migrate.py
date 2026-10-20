"""Run idempotent versioned database migrations: python -m account_book_server.migrate."""
import os
from pathlib import Path


def migrate(database_url=None):
    import psycopg

    url = database_url if database_url is not None else os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("Search database is not configured")
    with psycopg.connect(url, connect_timeout=5) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(681004225570101)")
            cursor.execute("CREATE TABLE IF NOT EXISTS rag_schema_migrations (version text PRIMARY KEY)")
            for path in sorted(Path(__file__).with_name("migrations").glob("*.sql")):
                cursor.execute("SELECT 1 FROM rag_schema_migrations WHERE version = %s", (path.name,))
                if cursor.fetchone() is None:
                    cursor.execute(path.read_text(encoding="utf-8-sig"))
                    cursor.execute("INSERT INTO rag_schema_migrations (version) VALUES (%s)", (path.name,))


if __name__ == "__main__":
    migrate()
