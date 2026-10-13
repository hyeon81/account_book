"""Verify provider wire contracts without network or credentials."""
import io
import json

import pytest

from account_book_server.infrastructure.openai_provider import OpenAIProvider


def test_embeddings_restore_input_order_and_set_timeout():
    calls = []

    def transport(request, timeout):
        calls.append((request, timeout))
        return io.BytesIO(json.dumps({"data": [
            {"index": 1, "embedding": [0, 1]}, {"index": 0, "embedding": [1, 0]},
        ]}).encode())

    provider = OpenAIProvider(api_key="test-only", transport=transport)
    assert provider.embed(["definition", "query"]) == [[1, 0], [0, 1]]
    request, timeout = calls[0]
    assert timeout == 25
    assert request.full_url == "https://api.openai.com/v1/embeddings"
    assert json.loads(request.data)["encoding_format"] == "float"


def test_generation_uses_only_retrieved_evidence_and_structured_schema():
    calls = []
    answer = {"status": "recommended", "category_id": "cafe", "reason": "카페 사례", "evidence_ids": ["category:cafe"]}

    def transport(request, timeout):
        calls.append(json.loads(request.data))
        return io.BytesIO(json.dumps({"status": "completed", "output": [
            {"type": "message", "content": [{"type": "output_text", "text": json.dumps(answer)}]},
        ]}).encode())

    provider = OpenAIProvider(api_key="test-only", transport=transport)
    evidence = [{"id": "category:cafe", "category_id": "cafe", "text": "커피", "source": "category"}]
    assert provider.generate({"merchant": "달빛커피"}, evidence, [{"id": "cafe"}]) == answer
    body = calls[0]
    assert body["store"] is False
    assert body["text"]["format"]["strict"] is True
    assert json.loads(body["input"])["evidence"] == evidence
    assert body["text"]["format"]["schema"]["properties"]["category_id"]["enum"] == [None, "cafe"]
    assert "신뢰할 수 없는" in body["instructions"]


def test_missing_key_never_calls_network():
    def forbidden(*_args, **_kwargs):
        pytest.fail("Network must not be called")

    with pytest.raises(RuntimeError, match="not configured"):
        OpenAIProvider(api_key="", transport=forbidden).embed(["query"])


@pytest.mark.parametrize("response", [
    {"data": []}, {"data": [{"index": 4, "embedding": [1]}]},
])
def test_malformed_embeddings_rejected(response):
    provider = OpenAIProvider(api_key="test-only", transport=lambda *_a, **_kw: io.BytesIO(json.dumps(response).encode()))
    with pytest.raises(RuntimeError):
        provider.embed(["query"])


def test_model_refusal_and_incomplete_response_rejected():
    for response in [{"status": "incomplete"}, {"status": "completed", "output": []}]:
        provider = OpenAIProvider(api_key="test-only", transport=lambda *_a, **_kw: io.BytesIO(json.dumps(response).encode()))
        with pytest.raises(RuntimeError):
            provider.generate({}, [{"id": "category:cafe"}], [{"id": "cafe"}])
