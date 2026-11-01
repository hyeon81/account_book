from dataclasses import dataclass

from account_book_agent.domain.period_spec import PeriodSpec


@dataclass(frozen=True, slots=True)
class GetBudgetStatusInput:
    period: PeriodSpec
