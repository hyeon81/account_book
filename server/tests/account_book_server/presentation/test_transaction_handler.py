"""Actual HTTP boundary with injected storage, never an AI key."""
import json
import threading
from http.client import HTTPConnection
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest

from account_book_server.application.ledger import Ledger
from account_book_server.main import create_server
from ledger_fakes import MemoryTransactions

ITEM = {"date": "2026-10-24", "type": "expense", "amount": 5000, "category_id": "cafe"}


@pytest.fixture
def endpoint():
    server = create_server(port=0, ledger=Ledger(MemoryTransactions()))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield "http://127.0.0.1:" + str(server.server_port), server
    server.shutdown()
    server.server_close()
    thread.join()


def request(endpoint, path, method="GET", payload=None, headers=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = Request(endpoint[0] + path, data=data, method=method,
                  headers={"Content-Type": "application/json", **(headers or {})})
    with urlopen(req) as response:
        body = response.read()
        return response.status, json.loads(body) if body else None


def test_crud_categories_and_import(endpoint):
    assert len(request(endpoint, "/api/categories")[1]["items"]) == 8
    status, item = request(endpoint, "/api/transactions", "POST", ITEM)
    assert status == 201
    path = "/api/transactions/" + item["id"]
    assert request(endpoint, path, "PATCH", {"amount": 6000})[1]["amount"] == 6000
    assert request(endpoint, "/api/transactions")[1]["items"][0]["id"] == item["id"]
    assert request(endpoint, path, "DELETE") == (204, None)
    assert request(endpoint, "/api/transactions/import", "POST", {"items": [{"id": "old-1", **ITEM}]}) == (
        200, {"imported": 1, "skipped": 0})


@pytest.mark.parametrize("path,method,payload,headers,status,code", [
    ("/api/transactions", "POST", {**ITEM, "user_id": "secret"}, {}, 422, "VALIDATION_ERROR"),
    ("/api/transactions?type=expense&type=income", "GET", None, {}, 422, "VALIDATION_ERROR"),
    ("/api/transactions/missing", "PATCH", {"amount": 1}, {}, 404, "TRANSACTION_NOT_FOUND"),
    ("/api/transactions", "GET", None, {"Origin": "https://evil.example"}, 403, "FORBIDDEN_ORIGIN"),
    ("/api/transactions", "POST", ITEM, {"Origin": "https://evil.example"}, 403, "FORBIDDEN_ORIGIN"),
    ("/api/transactions", "POST", ITEM, {"Content-Type": "text/plain"}, 415, "UNSUPPORTED_MEDIA_TYPE"),
])
def test_errors(endpoint, path, method, payload, headers, status, code):
    with pytest.raises(HTTPError) as error:
        request(endpoint, path, method, payload, headers)
    assert error.value.code == status
    assert json.load(error.value)["error"]["code"] == code


def test_database_failure_is_not_empty_success(endpoint):
    def fail(_filters):
        raise RuntimeError("secret database password")
    endpoint[1].ledger.repository.list = fail
    with pytest.raises(HTTPError) as error:
        request(endpoint, "/api/transactions")
    assert error.value.code == 503
    result = error.value.read()
    assert b"LEDGER_UNAVAILABLE" in result
    assert b"secret" not in result


@pytest.mark.parametrize("body,status", [(b"null", 422), (b"{", 422)], ids=["null", "malformed"])
def test_invalid_body_does_not_hang_or_save(endpoint, body, status):
    req = Request(endpoint[0] + "/api/transactions", data=body,
                  headers={"Content-Type": "application/json"})
    with pytest.raises(HTTPError) as error:
        urlopen(req, timeout=2)
    assert error.value.code == status
    assert request(endpoint, "/api/transactions")[1]["items"] == []


def test_oversized_body_is_rejected_before_reading_or_saving(endpoint):
    # The size limit must be enforced from headers, before waiting for a body.
    # Avoid a large concurrent upload whose unread bytes reset TCP on Windows.
    connection = HTTPConnection("127.0.0.1", endpoint[1].server_port, timeout=2)
    try:
        connection.putrequest("POST", "/api/transactions")
        connection.putheader("Content-Type", "application/json")
        connection.putheader("Content-Length", "200001")
        connection.endheaders()
        response = connection.getresponse()
        assert response.status == 413
        assert json.loads(response.read())["error"]["code"] == "REQUEST_TOO_LARGE"
    finally:
        connection.close()
    assert request(endpoint, "/api/transactions")[1]["items"] == []
