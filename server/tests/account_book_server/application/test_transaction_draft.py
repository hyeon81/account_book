"""Transaction draft extraction is followed by grounded category RAG."""

import pytest
from rag_fakes import DATASET_ID

from account_book_server.application.transaction_draft import TransactionDraft


def history(identifier="coffee", **overrides):
    value = {"id": identifier, "type": "expense", "category_id": "cafe",
             "merchant": "달빛커피", "memo": "라떼"}
    value.update(overrides)
    return value


def payload(**overrides):
    value = {"dataset_id": DATASET_ID, "message": "오늘 오후 3시에 달빛커피에서 5천원 썼어",
             "reference_date": "2026-10-14", "timezone": "Asia/Seoul",
             "history": [history()]}
    value.update(overrides)
    return value


class Provider:
    def __init__(self, answer=None):
        self.answer = answer if answer is not None else {
            "status": "extracted", "date": "2026-10-14", "type": "expense",
            "amount": 5000, "merchant": "달빛커피", "memo": "오후 3시 라떼",
            "reason": "단일 지출 거래를 추출했어요.",
        }
        self.extractions = []

    def extract(self, message, reference_date):
        self.extractions.append((message, reference_date))
        return self.answer


class Rag:
    def __init__(self, answer=None):
        self.answer = answer if answer is not None else {
            "status": "recommended", "category_id": "cafe",
            "reason": "저장된 커피 거래 근거를 사용했어요.",
            "evidence_ids": ["transaction:coffee"], "requires_confirmation": True,
            "evidence": [{"id": "transaction:coffee", "category_id": "cafe",
                          "source": "transaction", "text": "거래처: 달빛커피\n메모: 라떼"}],
        }
        self.calls = []

    def recommend(self, query):
        self.calls.append(query)
        return self.answer


def test_extraction_runs_before_rag_and_category_comes_only_from_rag():
    provider = Provider()
    rag = Rag()
    result = TransactionDraft(provider, rag).prepare(payload())
    assert provider.extractions == [("오늘 오후 3시에 달빛커피에서 5천원 썼어", "2026-10-14")]
    assert rag.calls == [{"dataset_id": DATASET_ID, "type": "expense", "merchant": "달빛커피",
                          "memo": "오후 3시 라떼", "history": [history()]}]
    assert result["status"] == "draft"
    assert result["draft"] == {"date": "2026-10-14", "type": "expense", "amount": 5000,
                               "merchant": "달빛커피", "memo": "오후 3시 라떼", "categoryId": "cafe"}
    assert result["recommendation"]["category_id"] == "cafe"
    assert result["requires_confirmation"] is True


def test_clarification_skips_rag_and_returns_no_draft():
    provider = Provider({"status": "needs_clarification", "date": None, "type": None,
                         "amount": None, "merchant": None, "memo": None,
                         "reason": "금액을 알려 주세요."})
    rag = Rag()
    result = TransactionDraft(provider, rag).prepare(payload())
    assert result["status"] == "needs_clarification"
    assert result["draft"] is None
    assert result["recommendation"] is None
    assert rag.calls == []


def test_rag_failure_keeps_extracted_draft_without_category():
    result = TransactionDraft(Provider(), Rag({"status": "unavailable", "category_id": None,
                                               "reason": "추천 실패", "evidence_ids": [],
                                               "requires_confirmation": True, "evidence": []})).prepare(payload())
    assert result["status"] == "draft"
    assert result["draft"]["categoryId"] == ""
    assert result["recommendation"]["status"] == "unavailable"


@pytest.mark.parametrize("answer", [
    {"status": "extracted", "date": "2026-10-14", "type": "expense", "amount": 0,
     "merchant": "달빛커피", "memo": "", "reason": "bad"},
    {"status": "extracted", "date": "2026-10-14", "type": "transfer", "amount": 5000,
     "merchant": "달빛커피", "memo": "", "reason": "bad"},
    {"status": "extracted", "date": "2026-02-30", "type": "expense", "amount": 5000,
     "merchant": "달빛커피", "memo": "", "reason": "bad"},
    [],
])
def test_malformed_extraction_fails_closed(answer):
    result = TransactionDraft(Provider(answer), Rag()).prepare(payload())
    assert result["status"] == "unavailable"
    assert result["draft"] is None


@pytest.mark.parametrize("invalid", [
    payload(dataset_id="invalid"),
    payload(timezone="UTC"),
    payload(reference_date="2026-02-30"),
    payload(message=""),
    payload(history=[history()] * 101),
    payload(history=[history("dup"), history("dup")]),
])
def test_invalid_requests_raise_before_provider(invalid):
    provider = Provider()
    with pytest.raises(ValueError):
        TransactionDraft(provider, Rag()).prepare(invalid)
    assert provider.extractions == []
