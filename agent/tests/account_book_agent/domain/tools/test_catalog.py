"""Tool contracts must stay narrow and preserve database-owned numbers."""
import json
from dataclasses import FrozenInstanceError, asdict, fields, is_dataclass
from decimal import Decimal

import pytest

from account_book_agent.domain.period_spec import PeriodSpec
from account_book_agent.domain.tools.catalog import (
    INPUT_TYPES, OUTPUT_TYPES, TOOL_CATALOG,
)
from account_book_agent.domain.tools.category_comparison import CategoryComparison
from account_book_agent.domain.tools.compare_periods_output import ComparePeriodsOutput
from account_book_agent.domain.tools.count_frequency_output import CountFrequencyOutput
from account_book_agent.domain.tools.detect_outliers_output import DetectOutliersOutput
from account_book_agent.domain.tools.input_schemas import PERIOD_SCHEMA
from account_book_agent.domain.tools.unassessed_category import UnassessedCategory


EXPECTED_NAMES = {
    "search_transactions", "summarize_spending", "count_frequency",
    "compare_periods", "detect_outliers", "get_budget_status",
}


def test_catalog_has_six_read_tools_and_two_line_descriptions():
    assert set(TOOL_CATALOG) == EXPECTED_NAMES
    assert set(INPUT_TYPES) == set(OUTPUT_TYPES) == EXPECTED_NAMES
    for tool in TOOL_CATALOG.values():
        assert tool["permission"] == "read"
        lines = tool["description"].splitlines()
        assert len(lines) == 2 and all(lines)
        assert "쓰지" in lines[1] or "대신" in lines[1]
        json.dumps(tool, ensure_ascii=False, allow_nan=False)


def test_contracts_reject_unknown_object_fields_recursively():
    def check(schema):
        if isinstance(schema, dict):
            if schema.get("type") == "object":
                assert schema["additionalProperties"] is False
                assert set(schema["required"]) <= set(schema["properties"])
            for value in schema.values():
                check(value)
        elif isinstance(schema, list):
            for value in schema:
                check(value)
    check(TOOL_CATALOG)


def test_json_contract_fields_match_typed_models():
    for name, tool in TOOL_CATALOG.items():
        for direction, models in (("input", INPUT_TYPES), ("output", OUTPUT_TYPES)):
            model = models[name]
            assert is_dataclass(model)
            assert model.__dataclass_params__.frozen
            assert set(tool[f"{direction}_schema"]["properties"]) == {
                field.name for field in fields(model)
            }


def test_list_limits_and_scope_are_explicit():
    search = TOOL_CATALOG["search_transactions"]
    assert search["input_schema"]["properties"]["limit"] == {
        "type": "integer", "minimum": 1, "maximum": 50, "default": 20,
    }
    assert search["output_schema"]["properties"]["items"]["maxItems"] == 50
    assert "merchant" not in TOOL_CATALOG["compare_periods"]["input_schema"]["properties"]
    assert set(TOOL_CATALOG["get_budget_status"]["input_schema"]["properties"]) == {"period"}
    for tool in TOOL_CATALOG.values():
        assert not {"user_id", "sql", "url", "mode"} & set(tool["input_schema"]["properties"])


def test_period_variants_require_their_own_arguments():
    variants = PERIOD_SCHEMA["oneOf"]
    recent = next(schema for schema in variants
                  if schema["properties"]["name"].get("const") == "last_n_days")
    assert set(recent["required"]) == {"name", "n"}
    assert recent["properties"]["n"] == {"type": "integer", "minimum": 1, "maximum": 365}
    explicit = next(schema for schema in variants
                    if schema["properties"]["name"].get("const") == "range")
    assert set(explicit["required"]) == {"name", "from_date", "to_date"}


def test_input_defaults_and_immutability():
    period = PeriodSpec(name="last_week")
    value = INPUT_TYPES["search_transactions"](period)
    assert (value.type, value.limit, value.category_id, value.merchant) == (
        "expense", 20, None, None,
    )
    with pytest.raises(FrozenInstanceError):
        value.limit = 100


def test_outputs_preserve_nullable_means_and_exact_database_decimals():
    empty = CountFrequencyOutput(0, 0, None, None)
    assert asdict(empty)["average_amount"] is None
    large = Decimal("9007199254740990.25")
    result = CountFrequencyOutput(2, 1, Decimal("0"), large)
    assert result.average_amount is large
    comparison = ComparePeriodsOutput((CategoryComparison("cafe", 0, 5000, 5000, None),))
    assert comparison.items[0].change_rate_percent is None
    assert comparison.items[0].difference == 5000
    with pytest.raises(FrozenInstanceError):
        comparison.items[0].a_total = 99


def test_unassessed_categories_have_a_typed_reason_and_strict_schema():
    result = DetectOutliersOutput((), (UnassessedCategory("cafe", "insufficient_history"),))
    assert asdict(result)["unassessed_categories"][0] == {
        "category_id": "cafe", "reason": "insufficient_history",
    }
    schema = TOOL_CATALOG["detect_outliers"]["output_schema"]["properties"][
        "unassessed_categories"]["items"]
    assert set(schema["required"]) == {"category_id", "reason"}
    assert schema["additionalProperties"] is False
    assert schema["properties"]["reason"]["minLength"] == 1
    with pytest.raises(FrozenInstanceError):
        result.unassessed_categories[0].reason = ""
