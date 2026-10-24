"""Use cases validate inputs before calling the persistence port."""
import pytest

from account_book_server.application.ledger import Ledger, encode_cursor
from account_book_server.domain.ledger_error import LedgerError
from ledger_fakes import MemoryTransactions

ITEM = {"date": "2026-10-24", "type": "expense", "amount": 5000, "category_id": "cafe"}


def test_create_update_delete_and_categories():
    ledger = Ledger(MemoryTransactions())
    created = ledger.create(ITEM)
    assert created["status"] == "confirmed"
    assert ledger.update(created["id"], {"amount": 7000})["amount"] == 7000
    assert len(ledger.categories()["items"]) == 8
    ledger.delete(created["id"])
    assert ledger.list({}) == {"items": [], "next_cursor": None}
    with pytest.raises(LedgerError, match="거래"):
        ledger.delete(created["id"])


def test_filters_and_cursor_are_normalized():
    repo = MemoryTransactions()
    cursor = encode_cursor({"date": "2026-10-24", "id": "abc_123"})
    Ledger(repo).list({"from": "2026-10-01", "to": "2026-10-24", "type": "expense",
                       "category_id": "cafe", "merchant": "카페%", "limit": "2", "cursor": cursor})
    assert repo.filters["cursor"] == ("2026-10-24", "abc_123")
    assert repo.filters["limit"] == 2


@pytest.mark.parametrize("filters", [
    {"from": "today"}, {"from": "2026-10-25", "to": "2026-10-24"},
    {"type": "all"}, {"category_id": "salary", "type": "expense"},
    {"limit": "0"}, {"limit": "501"}, {"limit": "1.0"}, {"cursor": "bad!"},
    {"merchant": ""}, {"merchant": "x" * 201}, {"user_id": "1"},
])
def test_invalid_filters_never_reach_repository(filters):
    repo = MemoryTransactions()
    with pytest.raises(LedgerError):
        Ledger(repo).list(filters)
    assert repo.filters is None


def test_import_validation_preserves_ids():
    repo = MemoryTransactions()
    ledger = Ledger(repo)
    assert ledger.import_items({"items": [{"id": "old-1", **ITEM}]}) == {"imported": 1, "skipped": 0}
    assert repo.imported[0]["id"] == "old-1"
    for payload in ({"items": []}, {"items": [{"id": "old-1", **ITEM}] * 2},
                    {"items": [{"id": "old-1", **ITEM}] * 101}, {"items": [ITEM]},
                    {"items": [{"id": "../bad", **ITEM}]}):
        with pytest.raises(LedgerError):
            ledger.import_items(payload)


def test_import_id_limit_matches_rag_history():
    ledger = Ledger(MemoryTransactions())
    assert ledger.import_items({"items": [{"id": "x" * 100, **ITEM}]})["imported"] == 1
    with pytest.raises(LedgerError):
        ledger.import_items({"items": [{"id": "x" * 101, **ITEM}]})
