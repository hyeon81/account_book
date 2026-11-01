"""HTTP boundary tests use a local fake, never an API key."""
import json
import threading
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest

from account_book_server.main import create_server


class FakeRag:
    def recommend(self, payload):
        if payload.get("invalid"):
            raise ValueError("private details")
        return {"status": "needs_clarification", "category_id": None}


@pytest.fixture
def endpoint():
    server = create_server(port=0, rag=FakeRag())
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield "http://127.0.0.1:" + str(server.server_port)
    server.shutdown()
    server.server_close()
    thread.join()


def request(endpoint, body=b'{}', **headers):
    return Request(endpoint + "/api/category-recommendation", data=body,
                   headers={"Content-Type": "application/json", **headers})


def test_health_and_request(endpoint):
    with urlopen(endpoint + "/api/health") as response:
        assert json.load(response) == {"status": "ok"}
    with urlopen(request(endpoint)) as response:
        assert response.headers["Cache-Control"] == "no-store"
        assert json.load(response)["status"] == "needs_clarification"


@pytest.mark.parametrize("body,headers,status", [
    (b'{}', {"Origin": "https://attacker.example"}, 403),
    (b'{}', {"Content-Type": "text/plain"}, 415),
    (b'{', {}, 400),
    (b'{"invalid":true}', {}, 400),
    (b' ' * 200001, {}, 413),
], ids=["origin", "content-type", "malformed-json", "invalid-payload", "oversized"])
def test_invalid_request_is_rejected(endpoint, body, headers, status):
    with pytest.raises(HTTPError) as error:
        urlopen(request(endpoint, body, **headers))
    assert error.value.code == status
    assert b"private details" not in error.value.read()



def test_full_rag_pipeline_over_http(endpoint):
    from types import SimpleNamespace
    from rag_fakes import category_rag as CategoryRag, DATASET_ID

    provider = SimpleNamespace(
        embed=lambda texts: [[1.0, 0.0] if "커피" in text or "카페" in text else [0.0, 1.0] for text in texts],
        generate=lambda query, evidence, categories: {
            "status": "recommended", "category_id": "cafe", "reason": "검색된 카페 근거",
            "evidence_ids": [item["id"] for item in evidence if item["category_id"] == "cafe"],
        },
    )
    # A separate server proves HTTP -> embeddings -> retrieval -> generation -> validation.
    server = create_server(port=0, rag=CategoryRag(provider))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        body = json.dumps({"dataset_id": DATASET_ID, "type": "expense", "merchant": "달빛커피", "memo": "라떼", "history": []}).encode()
        with urlopen(request("http://127.0.0.1:" + str(server.server_port), body)) as response:
            result = json.load(response)
        assert result["status"] == "recommended"
        assert result["category_id"] == "cafe"
        assert result["evidence_ids"] == ["category:cafe"]
        assert result["requires_confirmation"] is True
    finally:
        server.shutdown()
        server.server_close()
        thread.join()



def test_sequential_transaction_pipeline_over_http():
    from rag_fakes import category_rag as CategoryRag, DATASET_ID
    from account_book_server.application.transaction_draft import TransactionDraft
    from types import SimpleNamespace
    calls = []
    def extract(message, reference_date):
        calls.append("extract")
        return {"status": "extracted", "date": reference_date, "type": "expense", "amount": 5000,
                "merchant": "카페", "memo": "오후 3시 커피", "reason": "추출 완료"}
    def embed(texts):
        calls.append("embed")
        return [[1, 0] if "카페" in text or "커피" in text else [0, 1] for text in texts]
    def generate(query, evidence, categories):
        calls.append("generate")
        return {"status": "recommended", "category_id": "cafe", "reason": "카페 근거",
                "evidence_ids": [row["id"] for row in evidence if row["category_id"] == "cafe"]}
    provider = SimpleNamespace(extract=extract, embed=embed, generate=generate)
    payload = {"dataset_id": DATASET_ID, "message": "오늘 오후 3시에 카페에서 5천원 썼어", "reference_date": "2026-10-14",
               "timezone": "Asia/Seoul", "history": []}
    rag = CategoryRag(provider)
    server = create_server(port=0, rag=rag, drafts=TransactionDraft(provider, rag))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        req = Request("http://127.0.0.1:" + str(server.server_port) + "/api/transaction-draft",
                      data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
        with urlopen(req) as response:
            result = json.load(response)
        assert calls == ["extract", "embed", "generate"]
        assert result["draft"]["categoryId"] == "cafe"
        assert result["draft"]["amount"] == 5000
        assert result["requires_confirmation"] is True
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
