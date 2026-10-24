"""Run aggregate SQL against real PostgreSQL, not a Python calculator."""
import os
from pathlib import Path
from uuid import uuid4

import pytest

from account_book_server.application.ledger import Ledger
from account_book_server.application.statistics import Statistics
from account_book_server.infrastructure.postgres_transaction_repository import PostgresTransactionRepository
from account_book_server.infrastructure.postgres_statistics_repository import PostgresStatisticsRepository

ITEM = {"date": "2026-10-01", "type": "expense", "amount": 100,
        "category_id": "cafe", "merchant": "Coffee_100%", "memo": ""}
PERIOD = {"from": "2026-10-01", "to": "2026-10-07", "type": "expense"}
COMPARE = {"a_from": "2026-09-01", "a_to": "2026-09-30",
           "b_from": "2026-10-01", "b_to": "2026-10-31", "type": "expense"}


@pytest.fixture
def storage():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    import psycopg
    from psycopg import sql
    from psycopg.conninfo import make_conninfo
    schema = "stats_test_" + uuid4().hex
    with psycopg.connect(url) as connection:
        connection.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    scoped = make_conninfo(url, options=f"-c search_path={schema},public")
    try:
        migration = Path(__file__).parents[3] / "src/account_book_server/migrations/002_transactions.sql"
        with psycopg.connect(scoped) as connection:
            connection.execute(migration.read_text(encoding="utf-8"))
        repository = PostgresTransactionRepository(scoped)
        yield Ledger(repository), Statistics(PostgresStatisticsRepository(repository._connect))
    finally:
        with psycopg.connect(url) as connection:
            connection.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


def test_empty_single_same_day_and_payment_interval(storage):
    ledger, stats = storage
    empty = stats.frequency(PERIOD)
    assert (empty["payment_count"], empty["active_days"]) == (0, 0)
    assert empty["average_interval_days"] is None and empty["average_amount"] is None
    ledger.create(ITEM)
    assert stats.frequency(PERIOD)["average_interval_days"] is None
    ledger.create({**ITEM, "amount": 101})
    assert stats.frequency(PERIOD)["average_interval_days"] == 0
    ledger.create({**ITEM, "date": "2026-10-07", "amount": 103})
    result = stats.frequency(PERIOD)
    assert (result["payment_count"], result["active_days"]) == (3, 2)
    assert result["average_interval_days"] == 3
    assert result["average_amount"] == 101.33


def test_inclusive_boundaries_and_filters_match_listing(storage):
    ledger, stats = storage
    for changes in ({"date": "2026-09-30"}, {}, {"date": "2026-10-07"},
                    {"date": "2026-10-08"}, {"type": "income", "category_id": "salary"},
                    {"category_id": "food"}, {"merchant": "CoffeeX100other"}):
        ledger.create({**ITEM, **changes})
    for filters in ({}, {"category_id": "cafe"}, {"merchant": "%"}, {"merchant": "_100%"},
                    {"merchant": "COFFEE"}, {"merchant": "missing%"},
                    {"merchant": "COFFEE_100%", "category_id": "cafe"}):
        query = {**PERIOD, **filters}
        assert stats.frequency(query)["payment_count"] == len(ledger.list(query)["items"])
    assert stats.frequency({**PERIOD, "type": "income"})["payment_count"] == 1


def test_more_than_one_page_and_changes_are_immediately_reflected(storage):
    ledger, stats = storage
    for offset in range(0, 501, 100):
        ledger.import_items({"items": [{"id": str(i), **ITEM} for i in range(offset, min(offset + 100, 501))]})
    assert len(ledger.list({"limit": "500"})["items"]) == 500
    assert stats.frequency(PERIOD)["payment_count"] == 501
    ledger.update("0", {"date": "2026-11-01"})
    ledger.delete("1")
    assert stats.frequency(PERIOD)["payment_count"] == 499


def test_compare_baseline_zero_fill_overlap_and_exact_integer_totals(storage):
    ledger, stats = storage
    for changes in ({"date": "2026-09-01", "amount": 300}, {"amount": 400},
                    {"category_id": "food", "amount": 200},
                    {"category_id": "transport", "date": "2026-09-30", "amount": 100}):
        ledger.create({**ITEM, **changes})
    result = stats.compare(COMPARE)["items"]
    assert [r["category_id"] for r in result] == sorted(r["category_id"] for r in result)
    rows = {r["category_id"]: r for r in result}
    assert rows["cafe"] == {"category_id": "cafe", "a_total": 300, "b_total": 400,
                            "difference": 100, "change_rate_percent": 33.3}
    assert rows["transport"]["change_rate_percent"] == -100
    assert rows["food"]["change_rate_percent"] is None
    assert rows["health"]["change_rate_percent"] is None
    equal = stats.compare({**COMPARE, "b_from": "2026-09-01", "b_to": "2026-09-30",
                           "category_id": "cafe"})["items"]
    assert len(equal) == 1 and equal[0]["difference"] == 0 and equal[0]["change_rate_percent"] == 0
    for _ in range(3):
        ledger.create({**ITEM, "category_id": "health", "amount": 9007199254740991})
    health = stats.compare({**COMPARE, "category_id": "health"})["items"][0]
    assert health["b_total"] == 27021597764222973
    assert isinstance(health["b_total"], int)
