from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class UnassessedCategory:
    category_id: str
    reason: str
