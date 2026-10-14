"""Extract a transaction, validate it, then classify it using grounded RAG."""
from datetime import date

from account_book_server.application.category_rag import CATEGORIES, _documents, _string


def _date(value):
    if not isinstance(value, str) or len(value) != 10:
        raise ValueError("Invalid date")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as cause:
        raise ValueError("Invalid date") from cause
    if parsed.isoformat() != value:
        raise ValueError("Invalid date")
    return parsed.isoformat()


def _response(status, reason, draft=None, recommendation=None):
    return {"status": status, "reason": reason, "draft": draft,
            "recommendation": recommendation, "requires_confirmation": True}


class TransactionDraft:
    def __init__(self, provider, rag):
        self.provider = provider
        self.rag = rag

    def prepare(self, payload):
        if not isinstance(payload, dict) or payload.get("timezone") != "Asia/Seoul":
            raise ValueError("Invalid timezone")
        message = _string(payload.get("message"), "message", 4000, False)
        reference_date = _date(payload.get("reference_date"))
        history = payload.get("history", [])
        # Check browser history before contacting a provider. Only confirmed minimal fields are accepted.
        for kind in ("income", "expense"):
            _documents({"type": kind, "history": history}, [c for c in CATEGORIES if c["type"] == kind])
        try:
            answer = self.provider.extract(message, reference_date)
            if not isinstance(answer, dict):
                raise ValueError("Invalid extraction")
            reason = _string(answer.get("reason"), "reason", 500, False)
            if answer.get("status") == "needs_clarification":
                return _response("needs_clarification", reason)
            if answer.get("status") != "extracted" or answer.get("type") not in ("income", "expense"):
                raise ValueError("Invalid extraction status or type")
            amount = answer.get("amount")
            if isinstance(amount, bool) or not isinstance(amount, int) or not 0 < amount <= 9_007_199_254_740_991:
                raise ValueError("Invalid amount")
            draft = {"date": _date(answer.get("date")), "type": answer["type"], "amount": amount,
                     "merchant": _string(answer.get("merchant"), "merchant", 500),
                     "memo": _string(answer.get("memo"), "memo", 1000), "categoryId": ""}
            if not draft["merchant"] and not draft["memo"]:
                draft["memo"] = message[:1000]
        except Exception:
            return _response("unavailable", "거래 정보를 추출하지 못했어요. 다시 시도하거나 직접 입력해 주세요.")
        query = {"type": draft["type"], "merchant": draft["merchant"], "memo": draft["memo"],
                 "history": [record for record in history if record["type"] == draft["type"]]}
        recommendation = self.rag.recommend(query)
        if recommendation["status"] == "recommended":
            draft["categoryId"] = recommendation["category_id"]
        return _response("draft", recommendation["reason"], draft, recommendation)
