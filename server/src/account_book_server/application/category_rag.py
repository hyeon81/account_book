"""Request-scoped semantic retrieval and grounded category recommendations."""

import math

from account_book_server.application.rag_provider import RagProvider

CATEGORIES = (
    {"id": "salary", "name": "급여", "type": "income", "description": "월급, 급여, 상여금 등 근로 대가"},
    {"id": "other-income", "name": "기타 수입", "type": "income", "description": "용돈, 환급, 이자, 중고 판매 등 급여 이외 수입"},
    {"id": "food", "name": "식비", "type": "expense", "description": "식당 식사, 배달 음식, 식재료와 장보기"},
    {"id": "cafe", "name": "카페", "type": "expense", "description": "카페의 커피, 차, 음료와 디저트"},
    {"id": "shopping", "name": "쇼핑", "type": "expense", "description": "의류, 신발, 잡화 등 상품 구매"},
    {"id": "transport", "name": "교통", "type": "expense", "description": "버스, 지하철, 택시, 기차 등 이동 비용"},
    {"id": "living", "name": "생활", "type": "expense", "description": "공과금, 통신비, 주거와 생활용품 비용"},
    {"id": "health", "name": "건강", "type": "expense", "description": "병원 진료, 약국, 운동 등 건강 관리 비용"},
)


def _string(value, name, maximum, allow_empty=True):
    if not isinstance(value, str) or len(value) > maximum:
        raise ValueError(f"Invalid {name}")
    value = value.strip()
    if not allow_empty and not value:
        raise ValueError(f"Missing {name}")
    return value


def _query(payload):
    if not isinstance(payload, dict) or payload.get("type") not in ("income", "expense"):
        raise ValueError("Invalid transaction type")
    query = {"type": payload["type"],
             "merchant": _string(payload.get("merchant"), "merchant", 500),
             "memo": _string(payload.get("memo"), "memo", 1000)}
    if not query["merchant"] and not query["memo"]:
        raise ValueError("Merchant or memo is required")
    return query


def _documents(payload, categories):
    history = payload.get("history", [])
    if not isinstance(history, list) or len(history) > 100:
        raise ValueError("Invalid history")
    allowed = {category["id"] for category in categories}
    documents = [{"id": f"category:{category['id']}", "category_id": category["id"],
                  "source": "category", "text": f"{category['name']}: {category['description']}"}
                 for category in categories]
    seen = set()
    for record in history:
        if not isinstance(record, dict) or record.get("type") not in ("income", "expense"):
            raise ValueError("Invalid history record")
        identifier = _string(record.get("id"), "history id", 100, False)
        category_id = _string(record.get("category_id"), "category id", 100, False)
        merchant = _string(record.get("merchant"), "history merchant", 500)
        memo = _string(record.get("memo"), "history memo", 1000)
        if identifier in seen:
            raise ValueError("Duplicate history id")
        seen.add(identifier)
        if record["type"] != payload["type"] or category_id not in allowed:
            continue
        if merchant or memo:
            documents.append({"id": f"transaction:{identifier}", "category_id": category_id,
                              "source": "transaction", "text": f"거래처: {merchant}\n메모: {memo}"})
    return documents


def _vectors(values, count):
    if not isinstance(values, list) or len(values) != count:
        raise ValueError("Invalid embedding count")
    dimension = None
    normalized = []
    for vector in values:
        if not isinstance(vector, list) or not vector:
            raise ValueError("Invalid embedding")
        if dimension is None:
            dimension = len(vector)
        if len(vector) != dimension or any(isinstance(x, bool) or not isinstance(x, (int, float))
                                          or not math.isfinite(x) for x in vector):
            raise ValueError("Invalid embedding dimensions or values")
        norm = math.sqrt(sum(x * x for x in vector))
        if not math.isfinite(norm) or norm == 0:
            raise ValueError("Invalid embedding norm")
        normalized.append([x / norm for x in vector])
    return normalized


def _result(status, reason, category_id=None, evidence=None):
    evidence = evidence or []
    return {"status": status, "category_id": category_id, "reason": reason,
            "evidence_ids": [item["id"] for item in evidence],
            "requires_confirmation": True, "evidence": evidence}


def _validate_answer(answer, retrieved, categories):
    if not isinstance(answer, dict):
        raise ValueError("Invalid model answer")
    status = answer.get("status")
    reason = _string(answer.get("reason"), "reason", 500, False)
    identifiers = answer.get("evidence_ids")
    if not isinstance(identifiers, list) or len(identifiers) > 5:
        raise ValueError("Invalid citations")
    if any(not isinstance(identifier, str) for identifier in identifiers):
        raise ValueError("Invalid citation id")
    if len(set(identifiers)) != len(identifiers):
        raise ValueError("Duplicate citation")
    by_id = {item["id"]: item for item in retrieved}
    if any(identifier not in by_id for identifier in identifiers):
        raise ValueError("Ungrounded citation")
    if status == "needs_clarification":
        if answer.get("category_id") is not None:
            raise ValueError("Ambiguous answer has category")
        return _result(status, reason, evidence=[by_id[x] for x in identifiers])
    category_id = answer.get("category_id")
    if status != "recommended" or category_id not in {item["id"] for item in categories}:
        raise ValueError("Invalid suggested category")
    if not identifiers or any(by_id[x]["category_id"] != category_id for x in identifiers):
        raise ValueError("Recommendation lacks matching evidence")
    return _result(status, reason, category_id, [by_id[x] for x in identifiers])


class CategoryRag:
    """A provider supplies embed(texts) and generate(query, evidence, categories)."""

    def __init__(self, provider: RagProvider, threshold: float = 0.25) -> None:
        if not isinstance(threshold, (float, int)) or not 0 <= threshold <= 1:
            raise ValueError("Invalid retrieval threshold")
        self.provider = provider
        self.threshold = threshold

    def recommend(self, payload: dict[str, object]) -> dict[str, object]:
        query = _query(payload)
        categories = [dict(item) for item in CATEGORIES if item["type"] == query["type"]]
        documents = _documents(payload, categories)
        text = f"거래처: {query['merchant']}\n메모: {query['memo']}"
        try:
            vectors = _vectors(self.provider.embed([item["text"] for item in documents] + [text]),
                               len(documents) + 1)
            scored = [(sum(a * b for a, b in zip(vector, vectors[-1])), index)
                      for index, vector in enumerate(vectors[:-1])]
            scored.sort(key=lambda item: (-item[0], item[1]))
            retrieved = [documents[index] for score, index in scored[:5] if score >= self.threshold]
            if not retrieved:
                return _result("needs_clarification", "관련 근거를 찾지 못했습니다. 거래 내용을 더 입력하거나 카테고리를 직접 선택해 주세요.")
            answer = self.provider.generate(query, retrieved, categories)
            return _validate_answer(answer, retrieved, categories)
        except Exception:
            return _result("unavailable", "AI 추천을 완료하지 못했습니다. 잠시 후 다시 시도하거나 카테고리를 직접 선택해 주세요.")
