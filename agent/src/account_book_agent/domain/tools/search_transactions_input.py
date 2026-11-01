from dataclasses import dataclass

from account_book_agent.domain.period_spec import PeriodSpec


@dataclass(frozen=True, slots=True)
class SearchTransactionsInput:
    period: PeriodSpec
    type: str = "expense"
    category_id: str | None = None
    merchant: str | None = None
    limit: int = 20
