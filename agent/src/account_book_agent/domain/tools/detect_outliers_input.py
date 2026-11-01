from dataclasses import dataclass

from account_book_agent.domain.period_spec import PeriodSpec


@dataclass(frozen=True, slots=True)
class DetectOutliersInput:
    period: PeriodSpec
    type: str = "expense"
    category_id: str | None = None
    merchant: str | None = None
