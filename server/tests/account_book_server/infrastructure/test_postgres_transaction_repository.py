"""Real PostgreSQL tests, each isolated in a disposable schema."""
import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

from account_book_server.application.ledger import Ledger
from account_book_server.domain.ledger_error import LedgerError
from account_book_server.infrastructure.postgres_transaction_repository import PostgresTransactionRepository
from account_book_server.migrate import migrate

ITEM = {"date": "2026-10-24", "type": "expense", "amount": 5000,
        "category_id": "cafe", "merchant": "Coffee_100%", "memo": "커피"}


@pytest.fixture
def database():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    import psycopg
    from psycopg import sql
    from psycopg.conninfo import make_conninfo
    schema = "ledger_test_" + uuid4().hex
    # Install vector in public first; temporary schemas hold only ledger test data.
    migrate(url)
    with psycopg.connect(url) as connection:
        connection.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    scoped_url = make_conninfo(url, options=f"-c search_path={schema},public")
    try:
        with psycopg.connect(scoped_url) as connection:
            # Shadow the public migration history so migrations run in this schema.
            connection.execute("CREATE TABLE rag_schema_migrations (version text PRIMARY KEY)")
        migrate(scoped_url)
        yield scoped_url
    finally:
        with psycopg.connect(url) as connection:
            connection.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


def test_crud_and_migration_preserve_canonical_transactions(database):
    ledger = Ledger(PostgresTransactionRepository(database))
    assert ledger.list({}) == {"items": [], "next_cursor": None}
    created = ledger.create(ITEM)
    assert created["status"] == "confirmed"
    migrate(database)
    # New repository connections reuse the same committed data after migration.
    reopened = Ledger(PostgresTransactionRepository(database))
    assert reopened.list({})["items"] == [created]
    assert reopened.update(created["id"], {"amount": 7000})["amount"] == 7000
    with pytest.raises(LedgerError):
        reopened.update(created["id"], {"type": "income"})
    assert reopened.list({})["items"][0]["type"] == "expense"
    reopened.delete(created["id"])
    assert reopened.list({})["items"] == []
    with pytest.raises(LedgerError) as error:
        reopened.delete(created["id"])
    assert error.value.code == "TRANSACTION_NOT_FOUND"


def test_date_type_category_merchant_and_pagination(database):
    ledger = Ledger(PostgresTransactionRepository(database))
    rows = [
        {"id": "a", **ITEM, "date": "2026-10-01"},
        {"id": "b", **ITEM, "date": "2026-10-24"},
        {"id": "c", **ITEM, "date": "2026-10-24"},
        {"id": "d", **ITEM, "date": "2026-10-25"},
        {"id": "e", **ITEM, "date": "2026-10-24", "category_id": "food", "merchant": "Other"},
        {"id": "f", **ITEM, "date": "2026-10-24", "type": "income", "category_id": "salary"},
    ]
    ledger.import_items({"items": rows})
    filters = {"from": "2026-10-01", "to": "2026-10-24", "type": "expense",
               "category_id": "cafe", "merchant": "COFFEE_100%", "limit": "2"}
    first = ledger.list(filters)
    assert [item["id"] for item in first["items"]] == ["c", "b"]
    last = ledger.list({**filters, "cursor": first["next_cursor"]})
    assert [item["id"] for item in last["items"]] == ["a"]
    assert last["next_cursor"] is None
    assert ledger.list({"merchant": "%"})["items"]
    assert ledger.list({"merchant": "missing%"})["items"] == []
    assert [item["id"] for item in ledger.list({"type": "income"})["items"]] == ["f"]


def test_import_retry_after_edit_delete_and_conflict_atomicity(database):
    ledger = Ledger(PostgresTransactionRepository(database))
    source = {"id": "legacy", **ITEM}
    assert ledger.import_items({"items": [source]}) == {"imported": 1, "skipped": 0}
    ledger.update("legacy", {"amount": 1234})
    assert ledger.import_items({"items": [source]}) == {"imported": 0, "skipped": 1}
    assert ledger.list({})["items"][0]["amount"] == 1234
    ledger.delete("legacy")
    assert ledger.import_items({"items": [source]}) == {"imported": 0, "skipped": 1}
    assert ledger.list({})["items"] == []
    with pytest.raises(LedgerError) as error:
        ledger.import_items({"items": [{"id": "new", **ITEM}, {**source, "amount": 1}]})
    assert error.value.code == "IMPORT_CONFLICT"
    assert ledger.list({})["items"] == []
    assert ledger.import_items({"items": [{"id": "new", **ITEM}]}) == {"imported": 1, "skipped": 0}
    created = ledger.create(ITEM)
    with pytest.raises(LedgerError):
        ledger.import_items({"items": [{"id": created["id"], **ITEM}]})


def test_concurrent_import_is_idempotent(database):
    source = {"items": [{"id": "same", **ITEM}]}
    def run(_):
        return Ledger(PostgresTransactionRepository(database)).import_items(source)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, range(2)))
    assert sorted(result["imported"] for result in results) == [0, 1]
    assert len(Ledger(PostgresTransactionRepository(database)).list({})["items"]) == 1
