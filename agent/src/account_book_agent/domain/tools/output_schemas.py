"""Output contracts retain JSON numbers and never add model-computed totals."""
from copy import deepcopy

from .input_schemas import CATEGORY_IDS, DATE, object_schema


NONNEGATIVE = {"type": "integer", "minimum": 0}
DECIMAL_OR_NULL = {"type": ["number", "null"]}
NONNEGATIVE_OR_NULL = {"type": ["number", "null"], "minimum": 0}
CURRENCY = {"const": "KRW"}
BASIS = {"const": "confirmed_transactions"}
TRANSACTION_SCHEMA = object_schema({
    "id": {"type": "string", "minLength": 1, "maxLength": 100},
    "date": deepcopy(DATE), "type": {"enum": ["income", "expense"]},
    "amount": {"type": "integer", "minimum": 1, "maximum": 9_007_199_254_740_991},
    "currency": deepcopy(CURRENCY), "category_id": {"enum": list(CATEGORY_IDS)},
    "merchant": {"type": "string", "maxLength": 200},
    "memo": {"type": "string", "maxLength": 2000}, "status": {"const": "confirmed"},
}, ["id", "date", "type", "amount", "currency", "category_id", "merchant", "memo", "status"])
COMPARISON_SCHEMA = object_schema({
    "category_id": {"enum": list(CATEGORY_IDS)}, "a_total": deepcopy(NONNEGATIVE),
    "b_total": deepcopy(NONNEGATIVE), "difference": {"type": "integer"},
    "change_rate_percent": deepcopy(DECIMAL_OR_NULL),
}, ["category_id", "a_total", "b_total", "difference", "change_rate_percent"])
BUDGET_SCHEMA = object_schema({
    "category_id": {"enum": list(CATEGORY_IDS)}, "budget_amount": deepcopy(NONNEGATIVE),
    "spent_amount": deepcopy(NONNEGATIVE),
    "utilization_percent": deepcopy(NONNEGATIVE_OR_NULL),
    "projected_amount": deepcopy(NONNEGATIVE_OR_NULL),
}, ["category_id", "budget_amount", "spent_amount", "utilization_percent", "projected_amount"])
UNASSESSED_CATEGORY_SCHEMA = object_schema({
    "category_id": {"enum": list(CATEGORY_IDS)},
    "reason": {"type": "string", "minLength": 1, "maxLength": 500},
}, ["category_id", "reason"])


def with_basis(properties):
    return object_schema({**properties, "currency": deepcopy(CURRENCY),
                          "basis": deepcopy(BASIS)}, [*properties, "currency", "basis"])


OUTPUT_SCHEMAS = {
    "search_transactions": object_schema({
        "items": {"type": "array", "items": deepcopy(TRANSACTION_SCHEMA), "maxItems": 50},
        "next_cursor": {"type": ["string", "null"]}}, ["items", "next_cursor"]),
    "summarize_spending": with_basis({
        "income_total": deepcopy(NONNEGATIVE), "expense_total": deepcopy(NONNEGATIVE),
        "balance": {"type": "integer"}}),
    "count_frequency": with_basis({
        "payment_count": deepcopy(NONNEGATIVE), "active_days": deepcopy(NONNEGATIVE),
        "average_interval_days": deepcopy(NONNEGATIVE_OR_NULL),
        "average_amount": deepcopy(NONNEGATIVE_OR_NULL)}),
    "compare_periods": with_basis({
        "items": {"type": "array", "items": deepcopy(COMPARISON_SCHEMA), "maxItems": 30}}),
    "detect_outliers": object_schema({
        "items": {"type": "array", "items": deepcopy(TRANSACTION_SCHEMA), "maxItems": 5},
        "unassessed_categories": {"type": "array", "maxItems": 30,
                                  "items": deepcopy(UNASSESSED_CATEGORY_SCHEMA)}},
        ["items", "unassessed_categories"]),
    "get_budget_status": with_basis({
        "items": {"type": "array", "items": deepcopy(BUDGET_SCHEMA), "maxItems": 30}}),
}
