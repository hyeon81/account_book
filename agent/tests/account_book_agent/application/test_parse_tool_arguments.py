from dataclasses import FrozenInstanceError
import pytest
from account_book_agent.application.parse_tool_arguments import parse_tool_arguments


@pytest.mark.parametrize("args", [None, [], {"period":"today"},
    {"period":{"name":"today"},"type":"all"},
    {"period":{"name":"today"},"user_id":"other"},
    {"period":{"name":"today"},"url":"https://evil"},
    {"period":{"name":"last_n_days","n":True}},
    {"period":{"name":"today"},"merchant":""},
    {"period":{"name":"today"},"merchant":"x"*201},
    {"period":{"name":"today"},"category_id":"salary"},
    {"period":{"name":"today"},"category_id":"unknown"},
    {"period":{"name":"today","n":3}}])
def test_invalid_arguments(args):
    with pytest.raises((ValueError,TypeError)): parse_tool_arguments("count_frequency",args)


def test_defaults_and_immutable_input():
    result=parse_tool_arguments("count_frequency",{"period":{"name":"today"}})
    assert result.type == "expense"
    with pytest.raises(FrozenInstanceError): result.type="income"


def test_comparison_does_not_accept_merchant():
    with pytest.raises(ValueError):
        parse_tool_arguments("compare_periods",{"a":{"name":"today"},"b":{"name":"yesterday"},"merchant":"shop"})
