from decimal import Decimal
from types import SimpleNamespace
import pytest
from account_book_agent.application.model_tools import model_tools
from account_book_agent.domain.tools.catalog import TOOL_CATALOG
from account_book_agent.infrastructure.litellm_model import LiteLlmModel


def test_adapter_passes_schema_and_disables_both_retry_layers():
    received = {}
    class Message:
        def model_dump(self, **kwargs):
            return {"role": "assistant", "content": "확인할 기간을 알려주세요."}
    def complete(**kwargs):
        received.update(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=Message())])
    reply = LiteLlmModel(completion=complete, cost=lambda **_: 0.001).call_tools([], model_tools(), 3)
    assert reply.cost_usd == Decimal("0.001")
    assert received["num_retries"] == received["max_retries"] == 0
    assert received["timeout"] == 3 and received["parallel_tool_calls"] is False
    assert len(received["tools"]) == 3
    for tool in received["tools"]:
        function = tool["function"]
        assert function["parameters"] == TOOL_CATALOG[function["name"]]["input_schema"]


@pytest.mark.parametrize("cost", [None, float("nan"), -1])
def test_unaccountable_cost_fails_closed(cost):
    model = LiteLlmModel(completion=lambda **_: object(), cost=lambda **_: cost)
    with pytest.raises((ValueError, ArithmeticError)):
        model.call_tools([], [], 1)
