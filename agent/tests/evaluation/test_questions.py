"""Synthetic cases exercise orchestration; opt-in integration evaluates model choice."""
from collections import Counter
from datetime import date, timezone
from decimal import Decimal
import json
import os
from pathlib import Path
import pytest
from account_book_agent.application.model_reply import ModelReply
from account_book_agent.application.react_loop import ReactLoop
from account_book_agent.application.tool_executor import ToolExecutor
from account_book_agent.application.validated_answer import validated_answer
from evaluation_api import SyntheticApi

CASES = json.loads((Path(__file__).resolve().parents[2] / "evaluation/questions.json").read_text(encoding="utf-8"))


class ScriptedModel:
    def __init__(self, calls): self.calls = iter(calls)
    def call_tools(self, messages, tools, timeout):
        call = next(self.calls, None)
        if call is None:
            return ModelReply({"role": "assistant", "content": "확인한 결과입니다."}, Decimal("0.001"))
        name, arguments = call["name"], {k: v for k, v in call.items() if k != "name"}
        return ModelReply({"role": "assistant", "tool_calls": [{"id": str(len(messages)), "type": "function",
            "function": {"name": name, "arguments": json.dumps(arguments)}}]}, Decimal("0.001"))


def execute(model, question):
    executor = ToolExecutor(SyntheticApi(), date(2026, 10, 6), timezone.utc)
    return list(ReactLoop(model, executor).run(question))[-1][1]


def test_fixture_groups_match_course_query_scope():
    assert Counter(case["group"] for case in CASES) == {"single": 15, "period": 8, "multi": 4, "refusal": 3}
    assert len({case["id"] for case in CASES}) == 30


@pytest.mark.parametrize("case", CASES, ids=lambda c: str(c["id"]))
def test_thirty_cases_with_fake_model(case):
    result = execute(ScriptedModel(case["calls"]), case["question"])
    assert result["stop_reason"] == "complete"
    assert all(item["result"]["ok"] for item in result["observations"])
    assert [item["name"] for item in result["observations"]] == [call["name"] for call in case["calls"]]
    assert validated_answer(result)["reply"] == "확인한 결과입니다."


@pytest.mark.integration
@pytest.mark.parametrize("case", CASES, ids=lambda c: str(c["id"]))
def test_actual_model_choice_against_synthetic_api(case):
    if not os.environ.get("OPENAI_API_KEY"): pytest.skip("Inject a key explicitly; no .env is read")
    pytest.importorskip("litellm")
    from account_book_agent.infrastructure.litellm_model import LiteLlmModel
    result = execute(LiteLlmModel(os.environ.get("AGENT_MODEL", "gpt-4.1-mini")), case["question"])
    assert result["stop_reason"] == "complete"
    assert len(result["observations"]) == len(case["calls"])
    remaining = list(result["observations"])
    for expected in case["calls"]:
        match = next((item for item in remaining if item["name"] == expected["name"]
                     and all(item["arguments"].get(k) == v for k, v in expected.items() if k != "name")), None)
        assert match is not None
        assert match["result"]["ok"]
        remaining.remove(match)
    assert validated_answer(result)["reply"] == result["reply"]
