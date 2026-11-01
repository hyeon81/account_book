"""The agent knows an API port, never server modules or database sessions."""
from typing import Protocol


class ToolApi(Protocol):
    def get(self, tool: str, parameters: dict) -> dict:
        """Perform one read request; never retry or compute aggregates."""
        ...
