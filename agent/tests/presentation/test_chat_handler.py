from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from threading import Thread
import json
import pytest
from account_book_agent.presentation.chat_handler import ChatHandler
from chat_http_loop import FakeLoop


@pytest.fixture
def server():
    class Handler(ChatHandler):
        loop_factory = staticmethod(FakeLoop)
    instance = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=instance.serve_forever, daemon=True); thread.start()
    yield instance.server_port
    instance.shutdown(); instance.server_close(); thread.join()


def request(port, body, headers=None):
    connection = HTTPConnection("127.0.0.1", port, timeout=3)
    connection.request("POST", "/chat", body, headers or {"Content-Type": "application/json"})
    response = connection.getresponse()
    status, data = response.status, response.read().decode()
    connection.close()
    return status, data


def test_sse_event_contract_and_no_arguments(server):
    status, data = request(server, json.dumps({"message": "횟수"}))
    assert status == 200
    assert [line for line in data.splitlines() if line.startswith("event:")] == [
        "event: tool", "event: message", "event: done"]
    assert "secret" not in data and "arguments" not in data


@pytest.mark.parametrize("body", ['{}', 'null', '{', '{"message":""}', '{"message":"x","user_id":"x"}'])
def test_invalid_request_is_rejected_before_stream(server, body):
    assert request(server, body)[0] == 422


def test_cross_origin_and_wrong_media_are_rejected(server):
    assert request(server, '{}', {"Content-Type": "text/plain"})[0] == 415
    assert request(server, '{}', {"Content-Type": "application/json", "Origin": "https://evil.test"})[0] == 403


def test_model_failure_uses_public_error_event(server):
    status, data = request(server, json.dumps({"message": "fail"}))
    assert status == 200 and "event: error" in data and "event: done" in data
    assert "request_id" in data and "AGENT_UNAVAILABLE" in data
