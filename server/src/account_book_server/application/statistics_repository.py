"""Aggregate storage port; implementations return only SQL summaries."""
from typing import Protocol


class StatisticsRepository(Protocol):
    def frequency(self, filters: dict) -> dict: ...

    def compare(self, a: dict, b: dict, filters: dict) -> list[dict]: ...
