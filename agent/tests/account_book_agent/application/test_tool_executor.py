import json
from datetime import date,timedelta,timezone
from decimal import Decimal
from unittest.mock import Mock
import pytest
from account_book_agent.application.tool_executor import ToolExecutor
from account_book_agent.application.tool_api_error import ToolApiError

SEOUL=timezone(timedelta(hours=9),"Asia/Seoul")
PERIOD={"name":"last_week"}
FREQUENCY={"payment_count":2,"active_days":1,"average_interval_days":Decimal("0"),
           "average_amount":Decimal("9007199254740990.50"),"currency":"KRW","basis":"confirmed_transactions"}
TRANSACTION={"id":"sample","date":"2026-10-25","type":"expense","amount":5000,
             "category_id":"cafe","merchant":"cafe","memo":"","currency":"KRW","status":"confirmed"}


def executor(result=None):
    api=Mock();api.get.return_value=result if result is not None else FREQUENCY
    return ToolExecutor(api,date(2026,11,1),SEOUL,clock=lambda:1),api


def test_frequency_boundaries_and_decimal():
    service,api=executor()
    result=service.execute("count_frequency",{"period":PERIOD,"category_id":"cafe"},"call_1")
    assert result["ok"] and result["data"]["average_amount"]==Decimal("9007199254740990.50")
    api.get.assert_called_once_with("count_frequency",{"from":"2026-10-19","to":"2026-10-25","type":"expense","category_id":"cafe"})
    assert result["meta"] == {"row_count":1,"truncated":False,"elapsed_ms":0,
        "periods":{"period":{"from":"2026-10-19T00:00:00+09:00","to":"2026-10-26T00:00:00+09:00"}}}


@pytest.mark.parametrize("tool,args,response",[
    ("search_transactions",{"period":PERIOD},{"items":[],"next_cursor":None}),
    ("summarize_spending",{"period":PERIOD},{"income_total":0,"expense_total":0,"balance":0,"currency":"KRW","basis":"confirmed_transactions"}),
    ("compare_periods",{"a":{"name":"last_month"},"b":{"name":"this_month"}},
     {"items":[{"category_id":"cafe","a_total":0,"b_total":100,"difference":100,"change_rate_percent":None}],"currency":"KRW","basis":"confirmed_transactions"}),
    ("detect_outliers",{"period":PERIOD},{"items":[],"unassessed_categories":[{"category_id":"cafe","reason":"자료 부족"}]}),
    ("get_budget_status",{"period":PERIOD},{"items":[],"currency":"KRW","basis":"confirmed_transactions"}),
])
def test_all_read_tools_use_fake_api(tool,args,response):
    service,api=executor(response)
    result=service.execute(tool,args,"call_2")
    assert result["ok"]
    api.get.assert_called_once()
    if tool=="compare_periods":
        assert api.get.call_args.args[1]=={"a_from":"2026-10-01","a_to":"2026-10-31","b_from":"2026-11-01","b_to":"2026-11-30","type":"expense"}


@pytest.mark.parametrize("error,code",[(TimeoutError("secret"),"TOOL_UNAVAILABLE"),
    (ToolApiError("NOT_FOUND"),"NOT_FOUND"),(ToolApiError("INVALID_API_RESPONSE"),"INVALID_API_RESPONSE"),(ToolApiError("INVALID_ARGUMENT",True),"INVALID_ARGUMENT"),
    (RuntimeError("token secret"),"TOOL_UNAVAILABLE")])
def test_errors_are_safe_envelopes_without_retry(error,code):
    service,api=executor();api.get.side_effect=error
    result=service.execute("count_frequency",{"period":PERIOD},"call_3")
    assert not result["ok"] and result["error"]["code"]==code
    assert "secret" not in json.dumps(result)
    api.get.assert_called_once()


@pytest.mark.parametrize("args",[{"period":{"name":"range","from_date":"2026-02-30","to_date":"2026-03-01"}},
    {"period":PERIOD,"limit":3},{"period":PERIOD,"sql":"select *"}])
def test_validation_blocks_api(args):
    service,api=executor(); result=service.execute("count_frequency",args,"call_4")
    assert result["error"]["code"]=="INVALID_ARGUMENT"
    api.get.assert_not_called()


@pytest.mark.parametrize("value",[{**FREQUENCY,"payment_count":True},{**FREQUENCY,"average_amount":float("nan")},
    {**FREQUENCY,"average_amount":-1},{},[],None])
def test_invalid_response_does_not_become_zero(value):
    service,api=executor();api.get.return_value=value
    assert service.execute("count_frequency",{"period":PERIOD},"call_5")["error"]["code"]=="INVALID_API_RESPONSE"


def test_empty_frequency_preserves_null():
    service,_=executor({**FREQUENCY,"payment_count":0,"active_days":0,"average_interval_days":None,"average_amount":None})
    assert service.execute("count_frequency",{"period":PERIOD},"call_6")["data"]["average_amount"] is None


def test_list_row_and_byte_caps_are_visible():
    service,_=executor({"items":[{**TRANSACTION,"id":str(n),"memo":"가"*2000} for n in range(100)],"next_cursor":"next"})
    result=service.execute("search_transactions",{"period":PERIOD,"limit":50},"call_7")
    assert result["ok"] and result["meta"]["truncated"]
    assert len(json.dumps(result,ensure_ascii=False).encode())<=8192
    assert result["meta"]["row_count"]==len(result["data"]["items"])<50
    assert result["meta"]["note"]


def test_unknown_write_is_blocked():
    service,api=executor()
    assert service.execute("delete_transaction",{},"call_8")["error"]["code"]=="TOOL_NOT_ALLOWED"
    api.get.assert_not_called()
