from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class BudgetStatus:
    category_id: str
    budget_amount: int
    spent_amount: int
    utilization_percent: Decimal | int | None
    projected_amount: Decimal | int | None
