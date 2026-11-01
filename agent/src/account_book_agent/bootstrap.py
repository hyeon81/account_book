"""Application composition; environment is supplied by Docker, not read from files."""
import os
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from http.server import ThreadingHTTPServer
from account_book_agent.application.react_loop import ReactLoop
from account_book_agent.application.tool_executor import ToolExecutor
from account_book_agent.infrastructure.http_tool_api import HttpToolApi
from account_book_agent.infrastructure.litellm_model import LiteLlmModel
from account_book_agent.presentation.chat_handler import ChatHandler

SEOUL = timezone(timedelta(hours=9), "Asia/Seoul")


def build_loop():
    return ReactLoop(
        LiteLlmModel(os.environ.get("AGENT_MODEL", "gpt-4.1-mini")),
        ToolExecutor(HttpToolApi(os.environ.get("API_BASE_URL", "http://api:8000")),
                     datetime.now(SEOUL).date(), SEOUL),
        max_steps=int(os.environ.get("AGENT_MAX_STEPS", "8")),
        max_cost=Decimal(os.environ.get("AGENT_MAX_COST_USD", "0.50")),
    )


def main():
    ChatHandler.loop_factory = staticmethod(build_loop)
    ThreadingHTTPServer(("0.0.0.0", 8001), ChatHandler).serve_forever()


if __name__ == "__main__": main()
