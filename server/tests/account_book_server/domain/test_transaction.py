"""Ledger invariants do not require PostgreSQL or HTTP."""
import pytest

from account_book_server.domain.ledger_error import LedgerError
from account_book_server.domain.transaction import validate_transaction

VALID = {"date": "2024-02-29", "type": "expense", "category_id": "cafe", "amount": 5000}


def test_confirmed_input_defaults():
    assert validate_transaction(VALID) == {**VALID, "currency": "KRW", "merchant": "", "memo": ""}


@pytest.mark.parametrize("changes", [
    {"date": "2025-02-29"}, {"date": "2024-2-29"}, {"date": "0000-01-01"},
    {"amount": True}, {"amount": 0}, {"amount": 1.1}, {"amount": 9007199254740992},
    {"type": "income"}, {"category_id": "unknown"}, {"currency": "USD"},
    {"merchant": "x" * 201}, {"merchant": "a\x00b"}, {"memo": "x" * 2001},
    {"memo": None}, {"status": "draft"}, {"user_id": "arbitrary"},
])
def test_invalid_transaction_fields(changes):
    with pytest.raises(LedgerError) as error:
        validate_transaction({**VALID, **changes})
    assert error.value.code == "VALIDATION_ERROR"
