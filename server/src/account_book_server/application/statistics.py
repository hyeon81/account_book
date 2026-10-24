"""Validate explicit periods before requesting SQL aggregates."""
from datetime import date

from .ledger import validate_filters
from .statistics_repository import StatisticsRepository
from account_book_server.domain.transaction import invalid


def period(start, end):
    validated = validate_filters({"from": start, "to": end})
    if (date.fromisoformat(end) - date.fromisoformat(start)).days >= 366:
        invalid("조회 기간은 366일 이하여야 합니다.")
    return {key: validated[key] for key in ("from", "to")}


class Statistics:
    def __init__(self, repository: StatisticsRepository):
        self.repository = repository

    def frequency(self, query):
        required = {"from", "to", "type"}
        if not required <= query.keys() or query.keys() - required - {"category_id", "merchant"}:
            invalid("조회 조건을 확인해 주세요.")
        filters = validate_filters(query)
        filters.pop("limit")
        period(query["from"], query["to"])
        return {**filters, "currency": "KRW", "basis": "confirmed_transactions",
                **self.repository.frequency(filters)}

    def compare(self, query):
        required = {"a_from", "a_to", "b_from", "b_to", "type"}
        if not required <= query.keys() or query.keys() - required - {"category_id"}:
            invalid("비교 조건을 확인해 주세요.")
        a = period(query["a_from"], query["a_to"])
        b = period(query["b_from"], query["b_to"])
        filters = validate_filters({key: query[key] for key in ("type", "category_id") if key in query})
        filters.pop("limit")
        return {"a": a, "b": b, **filters, "currency": "KRW", "basis": "confirmed_transactions",
                "items": self.repository.compare(a, b, filters)}
