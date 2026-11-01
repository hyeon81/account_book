"""Validate API output and create immutable domain results."""
from account_book_agent.domain.tools.catalog import OUTPUT_SCHEMAS, OUTPUT_TYPES
from account_book_agent.domain.tools.transaction_record import TransactionRecord
from account_book_agent.domain.tools.category_comparison import CategoryComparison
from account_book_agent.domain.tools.budget_status import BudgetStatus
from account_book_agent.domain.tools.unassessed_category import UnassessedCategory
from .schema_validation import validate


def parse_tool_result(name, value):
    validate(value, OUTPUT_SCHEMAS[name])
    data = dict(value)
    if "items" in data:
        model = {"compare_periods": CategoryComparison,
                 "get_budget_status": BudgetStatus}.get(name, TransactionRecord)
        data["items"] = tuple(model(**item) for item in data["items"])
    if "unassessed_categories" in data:
        data["unassessed_categories"] = tuple(UnassessedCategory(**item)
                                               for item in data["unassessed_categories"])
    return OUTPUT_TYPES[name](**data)
