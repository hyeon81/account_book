from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class CategoryComparison:
    category_id: str
    a_total: int
    b_total: int
    difference: int
    change_rate_percent: Decimal | int | None
