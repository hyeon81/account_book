"""Compose application use cases and external providers."""
import os
import threading
from http.server import ThreadingHTTPServer

from account_book_server.application.category_rag import CategoryRag
from account_book_server.infrastructure.openai_provider import OpenAIProvider
from account_book_server.presentation.recommendation_handler import RecommendationHandler


def create_server(host: str = "127.0.0.1", port: int = 8000, rag=None) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer((host, port), RecommendationHandler)
    server.daemon_threads = True
    server.rag = rag if rag is not None else CategoryRag(OpenAIProvider())
    server.slots = threading.BoundedSemaphore(2)
    server.allowed_origins = {
        "http://localhost:8080", "http://127.0.0.1:8080",
        "http://localhost:5173", "http://127.0.0.1:5173",
    }
    server.allowed_origins.update(filter(None, os.environ.get("CATEGORY_ALLOWED_ORIGINS", "").split(",")))
    return server


if __name__ == "__main__":
    create_server(os.environ.get("API_HOST", "127.0.0.1"), int(os.environ.get("API_PORT", "8000"))).serve_forever()
