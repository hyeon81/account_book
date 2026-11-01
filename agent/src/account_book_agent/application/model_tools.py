"""Expose implemented HTTP reads using the existing schemas verbatim."""
from copy import deepcopy
from account_book_agent.domain.tools.catalog import TOOL_CATALOG

CONNECTED_TOOLS = frozenset({"search_transactions", "count_frequency", "compare_periods"})


def model_tools():
    return [{"type": "function", "function": {
        "name": name, "description": TOOL_CATALOG[name]["description"],
        "parameters": deepcopy(TOOL_CATALOG[name]["input_schema"]), "strict": False,
    }} for name in sorted(CONNECTED_TOOLS)]
