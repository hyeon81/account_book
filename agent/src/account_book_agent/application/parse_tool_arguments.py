"""Turn validated JSON arguments into frozen inputs before any API call."""
from account_book_agent.domain.period_spec import PeriodSpec
from account_book_agent.domain.tools.catalog import INPUT_TYPES, INPUT_SCHEMAS
from .schema_validation import validate

INCOME_CATEGORIES = {"salary", "other-income"}


def parse_tool_arguments(name, arguments):
    if name not in INPUT_TYPES: raise ValueError("Unknown tool")
    validate(arguments, INPUT_SCHEMAS[name])
    values = dict(arguments)
    for key in ("period", "a", "b"):
        if key in values: values[key] = PeriodSpec(**values[key])
    category = values.get("category_id")
    if category is not None:
        income = values.get("type", "expense") == "income"
        if (category in INCOME_CATEGORIES) != income: raise ValueError("Category/type mismatch")
    return INPUT_TYPES[name](**values)
