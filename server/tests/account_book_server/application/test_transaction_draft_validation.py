"""Reject malformed model values before retrieval, including JavaScript bounds."""
from types import SimpleNamespace

import pytest

from account_book_server.application.transaction_draft import TransactionDraft


@pytest.mark.parametrize("field,value", [
    ("amount", True), ("amount", -1), ("amount", 1.2), ("amount", 9007199254740992),
    ("date", "20261014"), ("merchant", "x" * 501), ("memo", "x" * 1001),
])
def test_bad_extraction_does_not_call_rag(field, value):
    answer = {"status": "extracted", "date": "2026-10-14", "type": "expense", "amount": 5000,
              "merchant": "카페", "memo": "오후 3시", "reason": "추출 완료", field: value}
    def forbidden(_query):
        pytest.fail("Invalid extraction must not reach retrieval")
    service = TransactionDraft(SimpleNamespace(extract=lambda *_args: answer), SimpleNamespace(recommend=forbidden))
    result = service.prepare({"message": "카페 5천원", "reference_date": "2026-10-14", "timezone": "Asia/Seoul"})
    assert result["status"] == "unavailable"
    assert result["draft"] is None


def test_extraction_provider_failure_preserves_no_private_details():
    def fail(*_args):
        raise RuntimeError("private provider data")
    service = TransactionDraft(SimpleNamespace(extract=fail), None)
    result = service.prepare({"message": "카페 5천원", "reference_date": "2026-10-14", "timezone": "Asia/Seoul"})
    assert result["status"] == "unavailable"
    assert "private" not in str(result)
