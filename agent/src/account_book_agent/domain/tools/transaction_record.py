from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TransactionRecord:
    id: str
    date: str
    type: str
    amount: int
    currency: str
    category_id: str
    merchant: str
    memo: str
    status: str = "confirmed"
