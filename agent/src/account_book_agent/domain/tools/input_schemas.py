"""JSON Schema contracts; parsing and calendar validation belong to application."""
from copy import deepcopy


def object_schema(properties, required):
    return {"type": "object", "properties": properties, "required": required,
            "additionalProperties": False}


CATEGORY_IDS = ("salary", "other-income", "food", "cafe", "shopping",
                "transport", "living", "health")
DATE = {"type": "string", "pattern": r"^\d{4}-\d{2}-\d{2}$"}
PERIOD_SCHEMA = {"oneOf": [
    object_schema({"name": {"type": "string", "enum": [
        "today", "yesterday", "this_week", "last_week", "this_month", "last_month",
        "this_year"]}}, ["name"]),
    object_schema({"name": {"const": "last_n_days"},
                   "n": {"type": "integer", "minimum": 1, "maximum": 365}}, ["name", "n"]),
    object_schema({"name": {"const": "month"},
                   "month": {"type": "string", "pattern": r"^\d{4}-(0[1-9]|1[0-2])$"}},
                  ["name", "month"]),
    object_schema({"name": {"const": "range"}, "from_date": DATE, "to_date": DATE},
                  ["name", "from_date", "to_date"]),
]}
TYPE = {"type": "string", "enum": ["income", "expense"], "default": "expense"}
CATEGORY = {"type": ["string", "null"], "enum": [None, *CATEGORY_IDS]}
MERCHANT = {"type": ["string", "null"], "minLength": 1, "maxLength": 200}


def filtered_schema(*, limit=False):
    properties = {"period": deepcopy(PERIOD_SCHEMA), "type": deepcopy(TYPE),
                  "category_id": deepcopy(CATEGORY), "merchant": deepcopy(MERCHANT)}
    if limit:
        properties["limit"] = {"type": "integer", "minimum": 1, "maximum": 50,
                               "default": 20}
    return object_schema(properties, ["period"])


INPUT_SCHEMAS = {
    "search_transactions": filtered_schema(limit=True),
    "summarize_spending": filtered_schema(),
    "count_frequency": filtered_schema(),
    "compare_periods": object_schema({
        "a": deepcopy(PERIOD_SCHEMA), "b": deepcopy(PERIOD_SCHEMA),
        "type": deepcopy(TYPE), "category_id": deepcopy(CATEGORY)}, ["a", "b"]),
    "detect_outliers": filtered_schema(),
    "get_budget_status": object_schema({"period": deepcopy(PERIOD_SCHEMA)}, ["period"]),
}
