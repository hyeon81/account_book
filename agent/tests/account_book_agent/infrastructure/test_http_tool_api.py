import json
from decimal import Decimal
from io import BytesIO
from unittest.mock import Mock
from urllib.error import HTTPError
import pytest
from account_book_agent.infrastructure.http_tool_api import HttpToolApi
from account_book_agent.application.tool_api_error import ToolApiError


def test_fixed_route_and_exact_decimal():
    response=BytesIO(b'{"from":"2026-10-01","payment_count":2,"active_days":1,"average_interval_days":0,"average_amount":9007199254740990.50,"currency":"KRW","basis":"confirmed_transactions"}')
    transport=Mock(return_value=response)
    api=HttpToolApi("http://api:8000",transport)
    result=api.get("count_frequency",{"merchant":"A&B%","from":"2026-10-01"})
    assert result["average_amount"]==Decimal("9007199254740990.50")
    assert "from" not in result
    request=transport.call_args.args[0]
    assert request.get_method()=="GET"
    assert request.full_url=="http://api:8000/api/stats/frequency?merchant=A%26B%25&from=2026-10-01"
    transport.assert_called_once()


@pytest.mark.parametrize("tool",["summarize_spending","get_budget_status","detect_outliers","http_get","create_transaction"])
def test_unimplemented_contract_never_calls_network(tool):
    transport=Mock(); api=HttpToolApi("http://api:8000",transport)
    with pytest.raises(ToolApiError): api.get(tool,{})
    transport.assert_not_called()


@pytest.mark.parametrize("status,code",[(404,"NOT_FOUND"),(422,"INVALID_ARGUMENT"),(500,"TOOL_UNAVAILABLE"),(503,"TOOL_UNAVAILABLE")])
def test_http_errors_are_sanitized_no_retry(status,code):
    transport=Mock(side_effect=HTTPError("http://api",status,"secret",{},None))
    with pytest.raises(ToolApiError) as caught: HttpToolApi("http://api:8000",transport).get("count_frequency",{})
    assert caught.value.code==code and "secret" not in str(caught.value)
    transport.assert_called_once()


@pytest.mark.parametrize("url",["file:///tmp/data","http://user:password@api","http://api/path","http://api?x=1"])
def test_no_arbitrary_origin_parts(url):
    with pytest.raises(ValueError): HttpToolApi(url)
