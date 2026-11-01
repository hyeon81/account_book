"""Chat tools port; existing server JSON completion remains independent."""
from typing import Protocol
from .model_reply import ModelReply


class LanguageModel(Protocol):
    def call_tools(self, messages: list[dict], tools: list[dict], timeout: float) -> ModelReply: ...
