from dataclasses import dataclass

from .budget_status import BudgetStatus


@dataclass(frozen=True, slots=True)
class GetBudgetStatusOutput:
    items: tuple[BudgetStatus, ...]
    currency: str = "KRW"
    basis: str = "confirmed_transactions"
