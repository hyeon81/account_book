"""Trusted composition selects a mode; neither user input nor model may switch it."""
from copy import deepcopy
from types import MappingProxyType
from account_book_agent.domain.tools.catalog import TOOL_CATALOG

MODE_TOOLS = MappingProxyType({
    "query": frozenset({"search_transactions", "summarize_spending", "count_frequency",
                        "compare_periods", "detect_outliers", "get_budget_status"}),
    "insight": frozenset({"summarize_spending", "count_frequency", "compare_periods",
                          "detect_outliers", "get_budget_status"}),
    "classify": frozenset(),
    "capture": frozenset(),
})


def names_for_mode(mode):
    if not isinstance(mode, str) or mode not in MODE_TOOLS:
        raise ValueError("Unknown execution mode")
    return frozenset(name for name in MODE_TOOLS[mode]
                     if TOOL_CATALOG[name]["permission"] == "read")


def tools_for_mode(mode):
    return [{"name": name, **deepcopy(TOOL_CATALOG[name])}
            for name in sorted(names_for_mode(mode))]
