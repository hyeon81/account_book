from dataclasses import dataclass

from .category_comparison import CategoryComparison


@dataclass(frozen=True, slots=True)
class ComparePeriodsOutput:
    items: tuple[CategoryComparison, ...]
    currency: str = "KRW"
    basis: str = "confirmed_transactions"
