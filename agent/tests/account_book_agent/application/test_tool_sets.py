import json
from datetime import date, timezone
from pathlib import Path
from unittest.mock import Mock
import pytest
from account_book_agent.application.tool_executor import ToolExecutor
from account_book_agent.application.tool_sets import MODE_TOOLS, names_for_mode, tools_for_mode


def test_query_has_six_reads_and_no_write_capability():
    tools=tools_for_mode("query")
    assert len(tools)==6
    assert all(tool["permission"]=="read" for tool in tools)
    assert not any(tool["name"].startswith(("create_","update_","delete_","set_","prepare_")) for tool in tools)


@pytest.mark.parametrize("tool",["create_transaction","update_transaction","delete_transaction","set_budget","prepare_transaction"])
def test_query_blocks_writes_before_api(tool):
    api=Mock();service=ToolExecutor(api,date(2026,11,1),timezone.utc,mode="query")
    result=service.execute(tool,{},"write")
    assert result["error"]["code"]=="TOOL_NOT_ALLOWED"
    api.get.assert_not_called()


@pytest.mark.parametrize("mode",["classify","capture"])
def test_unconnected_modes_fail_closed(mode):
    api=Mock(); service=ToolExecutor(api,date(2026,11,1),timezone.utc,mode=mode)
    result=service.execute("count_frequency",{"period":{"name":"today"}},"blocked")
    assert result["error"]["code"]=="TOOL_NOT_ALLOWED"
    api.get.assert_not_called()


def test_mode_cannot_be_injected_in_arguments():
    api=Mock();service=ToolExecutor(api,date(2026,11,1),timezone.utc)
    result=service.execute("count_frequency",{"period":{"name":"today"},"mode":"capture"},"mode")
    assert result["error"]["code"]=="INVALID_ARGUMENT"
    api.get.assert_not_called()


def test_other_modes_and_schema_copies():
    assert "search_transactions" not in names_for_mode("insight")
    tools=tools_for_mode("query");tools[0]["input_schema"].clear()
    assert tools_for_mode("query")[0]["input_schema"]
    with pytest.raises(TypeError): MODE_TOOLS["query"]=frozenset()
    with pytest.raises(ValueError): names_for_mode("admin")


def test_mode_schemas_match_reviewable_snapshot():
    actual={mode:tools_for_mode(mode) for mode in MODE_TOOLS}
    expected=json.loads((Path(__file__).with_name("tool_sets.snapshot.json")).read_text(encoding="utf-8"))
    assert actual==expected
