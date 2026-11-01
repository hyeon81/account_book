"""Exercise real HTTP parsing, use cases, and structured error contracts."""
import json
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest

from account_book_server.application.statistics import Statistics
from account_book_server.main import create_server


class Repository:
    failed = False

    def frequency(self, filters):
        if self.failed:
            raise RuntimeError("database offline")
        return {"payment_count": 0, "active_days": 0, "average_interval_days": None, "average_amount": None}

    def compare(self, a, b, filters):
        if self.failed:
            raise RuntimeError("database offline")
        return []


@pytest.fixture
def api():
    repository = Repository()
    server = create_server(port=0, statistics=Statistics(repository))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", repository
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def request(api, path, headers=None):
    try:
        response = urlopen(Request(api[0] + path, headers=headers or {}), timeout=3)
    except HTTPError as error:
        response = error
    with response:
        return response.status, json.load(response)


FREQUENCY = "/api/stats/frequency?from=2026-10-01&to=2026-10-31&type=expense"
COMPARE = "/api/stats/compare?a_from=2026-09-01&a_to=2026-09-30&b_from=2026-10-01&b_to=2026-10-31&type=expense"


def test_frequency_and_compare_success(api):
    status, body = request(api, FREQUENCY)
    assert status == 200 and body["payment_count"] == 0 and body["average_amount"] is None
    status, body = request(api, COMPARE)
    assert status == 200 and body["a"] == {"from": "2026-09-01", "to": "2026-09-30"}
    assert body["basis"] == "confirmed_transactions"


@pytest.mark.parametrize("path", [
    "/api/stats/frequency", FREQUENCY + "&type=income", FREQUENCY + "&limit=10",
    FREQUENCY + "&merchant=", FREQUENCY + "&user_id=other", FREQUENCY + "&bad",
    COMPARE + "&merchant=coffee", COMPARE.replace("2026-09-01", "last-week"),
])
def test_invalid_query_returns_422(api, path):
    status, body = request(api, path)
    assert status == 422 and body["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("path", [FREQUENCY, COMPARE])
def test_database_failure_never_returns_zero_success(api, path):
    api[1].failed = True
    status, body = request(api, path)
    assert status == 503 and body["error"]["code"] == "LEDGER_UNAVAILABLE"


def test_origin_and_summary_scope(api):
    status, body = request(api, FREQUENCY, {"Origin": "https://example.com"})
    assert status == 403 and body["error"]["code"] == "FORBIDDEN_ORIGIN"
    assert request(api, "/api/summary?month=2026-10")[0] == 404
