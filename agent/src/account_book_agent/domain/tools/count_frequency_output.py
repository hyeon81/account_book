from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class CountFrequencyOutput:
    payment_count: int
    active_days: int
    average_interval_days: Decimal | int | None
    average_amount: Decimal | int | None
    currency: str = "KRW"
    basis: str = "confirmed_transactions"
