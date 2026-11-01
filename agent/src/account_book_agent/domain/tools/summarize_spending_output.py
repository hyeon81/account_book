from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SummarizeSpendingOutput:
    income_total: int
    expense_total: int
    balance: int
    currency: str = "KRW"
    basis: str = "confirmed_transactions"
