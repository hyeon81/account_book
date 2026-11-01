from dataclasses import dataclass

from account_book_agent.domain.period_spec import PeriodSpec


@dataclass(frozen=True, slots=True)
class ComparePeriodsInput:
    a: PeriodSpec
    b: PeriodSpec
    type: str = "expense"
    category_id: str | None = None
