from dataclasses import dataclass

from .transaction_record import TransactionRecord


@dataclass(frozen=True, slots=True)
class SearchTransactionsOutput:
    items: tuple[TransactionRecord, ...]
    next_cursor: str | None = None
