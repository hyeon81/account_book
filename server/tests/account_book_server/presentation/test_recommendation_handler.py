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
    from account_book_server.application.category_rag import CategoryRag

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
        body = json.dumps({"type": "expense", "merchant": "달빛커피", "memo": "라떼", "history": []}).encode()
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
