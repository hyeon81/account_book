from datetime import date, timezone
from decimal import Decimal
from account_book_agent.application.model_reply import ModelReply
from account_book_agent.application.react_loop import ReactLoop
from account_book_agent.application.tool_executor import ToolExecutor
from chat_fake_api import FakeApi


class FakeModel:
    def __init__(self, replies): self.replies, self.messages = iter(replies), []
    def call_tools(self, messages, tools, timeout):
        self.messages.append(list(messages))
        return next(self.replies)


def call(arguments='{"period":{"name":"today"}}'):
    return ModelReply({"role": "assistant", "tool_calls": [{"id": "a", "type": "function",
                       "function": {"name": "count_frequency", "arguments": arguments}}]}, Decimal("0.01"))


def loop(model, **kwargs):
    return ReactLoop(model, ToolExecutor(FakeApi(), date(2026, 10, 6), timezone.utc), **kwargs)


def test_tool_result_is_fed_back_without_rounding_or_arguments_in_events():
    model = FakeModel([call(), ModelReply({"role": "assistant", "content": "3건입니다."}, Decimal("0.01"))])
    events = list(loop(model).run("오늘 결제 건수"))
    assert events[0] == ("tool", {"name": "count_frequency"})
    result = events[-1][1]
    assert result["stop_reason"] == "complete" and result["cost_usd"] == Decimal("0.02")
    assert '"average_interval_days":1.50' in model.messages[-1][-1]["content"]


def test_repeated_call_stops_before_second_execution():
    events = list(loop(FakeModel([call(), call()])).run("횟수"))
    assert len(events[-1][1]["observations"]) == 1
    assert events[-1][1]["stop_reason"] == "repeated_call"


def test_steps_and_cost_stop_with_partial_results():
    assert list(loop(FakeModel([call()]), max_steps=1).run("횟수"))[-1][1]["stop_reason"] == "steps"
    model = FakeModel([call()])
    result = list(loop(model, max_cost=Decimal("0.005")).run("횟수"))[-1][1]
    assert result["stop_reason"] == "cost" and not result["observations"]


def test_time_exhaustion_and_exception_do_not_invent_zero():
    times = iter([0, 21])
    assert list(loop(FakeModel([]), clock=lambda: next(times)).run("횟수"))[-1][1]["stop_reason"] == "time"
    assert list(loop(FakeModel([])).run("횟수"))[-1][1]["stop_reason"] == "error"


def test_no_tool_is_executed_when_stream_delivery_consumes_deadline():
    now = [0]
    events = loop(FakeModel([call()]), clock=lambda: now[0]).run("횟수")
    assert next(events)[0] == "tool"
    now[0] = 21
    result = next(events)[1]
    assert result["stop_reason"] == "time" and result["observations"] == []


def test_prompt_separates_date_display_and_unsupported_queries():
    model = FakeModel([ModelReply({"role": "assistant", "content": "확인할게요."}, Decimal("0.01"))])
    list(loop(model).run("질문"))
    prompt = model.messages[0][0]["content"]
    assert "종료 제외" in prompt and "날짜의 숫자는 답변 문장에 쓰지 않는다" in prompt
    assert "도구도 호출하지 말고" in prompt
