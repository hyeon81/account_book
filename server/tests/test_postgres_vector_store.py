"""Run against a disposable PostgreSQL/pgvector database via TEST_DATABASE_URL."""
from concurrent.futures import ThreadPoolExecutor
import os
from threading import Event
from uuid import uuid4

import pytest

from account_book_server.infrastructure.postgres_vector_store import PostgresVectorStore
from account_book_server.migrate import migrate


class Provider:
    embedding_model = "integration-model"
    embedding_dimensions = 2

    def __init__(self):
        self.calls = []

    def embed(self, texts):
        self.calls.append(texts)
        return [[1.0] + [0.0] * (self.embedding_dimensions - 1) for text in texts]


def document(identifier="transaction:one", text="coffee", category="cafe"):
    return {"id": identifier, "text": text, "category_id": category, "source": "transaction"}


@pytest.fixture
def database():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    import psycopg

    migrate(url)
    dataset = str(uuid4())
    yield url, dataset
    with psycopg.connect(url) as connection:
        connection.execute("DELETE FROM rag_documents WHERE dataset_id = %s", (dataset,))


def retrieve(database, provider, documents, transaction_type="expense", threshold=0.25):
    url, dataset = database
    return PostgresVectorStore(url).retrieve(provider, documents, "query", dataset, transaction_type, threshold)


def test_migration_is_repeatable_and_cache_survives_new_connection(database):
    provider = Provider()
    assert retrieve(database, provider, [document()]) == [document()]
    migrate(database[0])
    assert retrieve(database, provider, [document()]) == [document()]
    assert provider.calls == [["coffee", "query"], ["query"]]


def test_edits_reembed_but_category_updates_only_metadata(database):
    provider = Provider()
    retrieve(database, provider, [document()])
    assert retrieve(database, provider, [document(category="food")]) == [document(category="food")]
    assert provider.calls[-1] == ["query"]
    assert retrieve(database, provider, [document(text="lunch", category="food")]) == [document(text="lunch", category="food")]
    assert provider.calls[-1] == ["lunch", "query"]


def test_removed_documents_and_empty_history_delete_stored_examples(database):
    import psycopg

    provider = Provider()
    retrieve(database, provider, [document(), document("transaction:two", "lunch")])
    assert retrieve(database, provider, [document("transaction:two", "lunch")]) == [document("transaction:two", "lunch")]
    assert retrieve(database, provider, []) == []
    with psycopg.connect(database[0]) as connection:
        assert connection.execute("SELECT count(*) FROM rag_documents WHERE dataset_id = %s", (database[1],)).fetchone()[0] == 0


def test_type_model_and_dimensions_are_partitioned(database):
    provider = Provider()
    retrieve(database, provider, [document()])
    retrieve(database, provider, [document()], "income")
    assert provider.calls[-1] == ["coffee", "query"]
    provider.embedding_model = "another-model"
    retrieve(database, provider, [document()])
    assert provider.calls[-1] == ["coffee", "query"]
    provider.embedding_dimensions = 3
    retrieve(database, provider, [document()])
    assert provider.calls[-1] == ["coffee", "query"]
    provider.embedding_dimensions = 2
    retrieve(database, provider, [document()])
    assert provider.calls[-1] == ["query"]


def test_other_dataset_cannot_reuse_or_return_vectors(database):
    import psycopg

    other_dataset = str(uuid4())
    provider = Provider()
    retrieve(database, provider, [document()])
    try:
        assert retrieve((database[0], other_dataset), provider, []) == []
        retrieve((database[0], other_dataset), provider, [document()])
        assert provider.calls[-1] == ["coffee", "query"]
    finally:
        with psycopg.connect(database[0]) as connection:
            connection.execute("DELETE FROM rag_documents WHERE dataset_id = %s", (other_dataset,))


def test_exact_cosine_threshold_and_top_five(database):
    class Ranked(Provider):
        def embed(self, texts):
            return [[0.0, 1.0] if text == "unrelated" else [1.0, 0.0] for text in texts]

    docs = [document(str(index)) for index in range(7)] + [document("off-topic", "unrelated")]
    assert retrieve(database, Ranked(), docs) == docs[:5]
    assert retrieve(database, Ranked(), [document("off-topic", "unrelated")]) == []


@pytest.mark.parametrize("invalid", [[0.0, 0.0], [float("nan"), 1.0], [float("inf"), 1.0], [1.0], [True, 1.0]])
def test_invalid_vectors_roll_back_without_poisoning_cache(database, invalid):
    class Invalid(Provider):
        def embed(self, texts):
            return [invalid for text in texts]

    with pytest.raises(ValueError):
        retrieve(database, Invalid(), [document()])
    provider = Provider()
    assert retrieve(database, provider, [document()]) == [document()]
    assert provider.calls == [["coffee", "query"]]


def test_concurrent_requests_return_only_their_own_snapshot(database):
    entered = Event()
    release = Event()

    class SlowProvider(Provider):
        def embed(self, texts):
            entered.set()
            assert release.wait(10)
            return super().embed(texts)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(retrieve, database, SlowProvider(), [document(text="old")])
        assert entered.wait(10)
        second = executor.submit(retrieve, database, Provider(), [document(text="new", category="food")])
        release.set()
        assert first.result(timeout=15) == [document(text="old")]
        assert second.result(timeout=15) == [document(text="new", category="food")]
    assert retrieve(database, Provider(), [document(text="new", category="food")]) == [document(text="new", category="food")]
