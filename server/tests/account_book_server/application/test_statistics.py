"""Use cases validate requests without loading transactions or calling models."""
import pytest

from account_book_server.application.statistics import Statistics
from account_book_server.domain.ledger_error import LedgerError


class Repository:
    def frequency(self, filters):
        self.filters = filters
        return {"payment_count": 0, "active_days": 0, "average_interval_days": None, "average_amount": None}

    def compare(self, a, b, filters):
        self.periods = (a, b, filters)
        return []


QUERY = {"from": "2026-10-01", "to": "2026-10-31", "type": "expense"}
COMPARE = {"a_from": "2026-09-01", "a_to": "2026-09-30",
           "b_from": "2026-10-01", "b_to": "2026-10-31", "type": "expense"}


def test_frequency_keeps_filters_and_null_averages():
    repo = Repository()
    result = Statistics(repo).frequency({**QUERY, "category_id": "cafe", "merchant": "100%_Coffee"})
    assert repo.filters == {**QUERY, "category_id": "cafe", "merchant": "100%_Coffee"}
    assert result["average_amount"] is None
    assert result["basis"] == "confirmed_transactions"


def test_compare_preserves_independent_overlapping_periods():
    repo = Repository()
    result = Statistics(repo).compare({**COMPARE, "b_from": "2026-09-15"})
    assert result["a"]["to"] == "2026-09-30"
    assert repo.periods[1]["from"] == "2026-09-15"


@pytest.mark.parametrize("changes", [
    {"type": "all"}, {"category_id": "salary"}, {"merchant": ""}, {"merchant": "a" * 201},
    {"from": "last week"}, {"from": "2026-02-30"}, {"from": "2026-11-01"},
    {"from": "2025-10-01"}, {"limit": "1"}, {"cursor": "x"}, {"user_id": "1"},
])
def test_frequency_rejects_invalid_filters(changes):
    with pytest.raises(LedgerError):
        Statistics(Repository()).frequency({**QUERY, **changes})


@pytest.mark.parametrize("key", QUERY)
def test_frequency_requires_dates_and_type(key):
    with pytest.raises(LedgerError):
        Statistics(Repository()).frequency({k: v for k, v in QUERY.items() if k != key})


@pytest.mark.parametrize("changes", [{"merchant": "coffee"}, {"category_id": "salary"},
                                      {"a_to": "2026-08-31"}, {"b_to": "2028-01-01"}])
def test_compare_rejects_invalid_filters(changes):
    with pytest.raises(LedgerError):
        Statistics(Repository()).compare({**COMPARE, **changes})


def test_inclusive_leap_year_period_allows_366_days():
    Statistics(Repository()).frequency({**QUERY, "from": "2024-01-01", "to": "2024-12-31"})
    with pytest.raises(LedgerError):
        Statistics(Repository()).frequency({**QUERY, "from": "2024-01-01", "to": "2025-01-01"})
