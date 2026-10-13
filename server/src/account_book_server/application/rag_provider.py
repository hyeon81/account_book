"""External model boundary consumed by the category recommendation use case."""

from typing import Protocol


class RagProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one semantic vector for every supplied text."""
        ...

    def generate(
        self,
        query: dict[str, str],
        evidence: list[dict[str, str]],
        categories: list[dict[str, str]],
    ) -> dict[str, object]:
        """Return a structured recommendation grounded in supplied evidence."""
        ...
