from dataclasses import dataclass

from .transaction_record import TransactionRecord
from .unassessed_category import UnassessedCategory


@dataclass(frozen=True, slots=True)
class DetectOutliersOutput:
    items: tuple[TransactionRecord, ...]
    unassessed_categories: tuple[UnassessedCategory, ...]
