"""Container HTTP smoke with injected provider/API; no key or external network."""
from datetime import date, timezone
from http.server import ThreadingHTTPServer
import json
from threading import Thread
from types import SimpleNamespace
from urllib.request import Request, urlopen
from account_book_agent.application.react_loop import ReactLoop
from account_book_agent.application.tool_executor import ToolExecutor
from account_book_agent.infrastructure.litellm_model import LiteLlmModel
from account_book_agent.presentation.chat_handler import ChatHandler


def completion(**kwargs):
    message = {"role": "assistant", "content": "카페 결제는 3건입니다."}
    if kwargs["messages"][-1]["role"] == "user":
        message = {"role": "assistant", "tool_calls": [{"id": "a", "type": "function", "function": {
            "name": "count_frequency", "arguments": json.dumps({"period": {"name": "today"}, "category_id": "cafe"})}}]}
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(model_dump=lambda **_: message))])


def factory():
    model = LiteLlmModel(completion=completion, cost=lambda **_: 0.001)
    api = SimpleNamespace(get=lambda *_: {"payment_count": 3, "active_days": 2,
        "average_interval_days": 1, "average_amount": 5000, "currency": "KRW", "basis": "confirmed_transactions"})
    return ReactLoop(model, ToolExecutor(api, date(2026, 10, 6), timezone.utc))


ChatHandler.loop_factory = staticmethod(factory)
server = ThreadingHTTPServer(("127.0.0.1", 0), ChatHandler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    request = Request(f"http://127.0.0.1:{server.server_port}/chat",
        data=json.dumps({"message": "오늘 카페 결제 건수"}).encode(), headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=5) as response:
        stream = response.read().decode()
    assert "event: tool" in stream and "event: message" in stream and "event: done" in stream
    assert '"payment_count":3' in stream and "3건" in stream and '"arguments"' not in stream
    print("HTTP SSE + model adapter + ReAct + tool executor + numerical validation OK (synthetic)")
finally:
    server.shutdown(); server.server_close(); thread.join()
