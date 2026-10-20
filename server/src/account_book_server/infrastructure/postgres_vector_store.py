"""Persistent exact cosine retrieval; ledger originals remain in the browser."""
import hashlib
import json
import math
import os

DOCUMENT_FORMAT_VERSION = 1


def _normalized(values, count, dimensions):
    if not isinstance(values, list) or len(values) != count:
        raise ValueError("Invalid embedding count")
    result = []
    for vector in values:
        if not isinstance(vector, list) or len(vector) != dimensions:
            raise ValueError("Invalid embedding dimensions")
        if any(isinstance(value, bool) or not isinstance(value, (int, float))
               or not math.isfinite(value) for value in vector):
            raise ValueError("Invalid embedding values")
        norm = math.hypot(*vector)
        if not math.isfinite(norm) or norm == 0:
            raise ValueError("Invalid embedding norm")
        result.append([value / norm for value in vector])
    return result


def _vector_literal(vector):
    return json.dumps(vector, allow_nan=False, separators=(",", ":"))


class PostgresVectorStore:
    def __init__(self, database_url=None):
        self.database_url = database_url if database_url is not None else os.environ.get("DATABASE_URL", "")

    def retrieve(self, provider, documents, query_text, dataset_id, transaction_type, threshold):
        import psycopg
        from psycopg.types.json import Jsonb

        model = getattr(provider, "embedding_model", "text-embedding-3-small")
        dimensions = getattr(provider, "embedding_dimensions", 1536)
        if not isinstance(model, str) or not model or isinstance(dimensions, bool) \
                or not isinstance(dimensions, int) or not 1 <= dimensions <= 16000:
            raise ValueError("Invalid embedding configuration")
        if not self.database_url:
            raise RuntimeError("Search database is not configured")
        current = [{**document, "text_hash": hashlib.sha256(document["text"].encode("utf-8")).hexdigest(),
                    "ordinal": index} for index, document in enumerate(documents)]
        scope = (str(dataset_id), transaction_type, model, dimensions, DOCUMENT_FORMAT_VERSION)
        # Hold only this dataset/type lock through synchronization and retrieval. The
        # caller generates its answer after this transaction has released the lock.
        with psycopg.connect(self.database_url, connect_timeout=5, options="-c statement_timeout=10000") as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                               (str(dataset_id) + ":" + transaction_type,))
                cursor.execute("""SELECT document_id, text_hash FROM rag_documents
                    WHERE dataset_id = %s AND transaction_type = %s AND embedding_model = %s
                      AND embedding_dimensions = %s AND document_format_version = %s""", scope)
                existing = dict(cursor.fetchall())
                changed = [document for document in current
                           if existing.get(document["id"]) != document["text_hash"]]
                vectors = _normalized(provider.embed([document["text"] for document in changed] + [query_text]),
                                      len(changed) + 1, dimensions)
                for document, vector in zip(changed, vectors[:-1]):
                    cursor.execute("""INSERT INTO rag_documents
                        (dataset_id, transaction_type, embedding_model, embedding_dimensions,
                         document_format_version, document_id, category_id, source, text, text_hash, embedding)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
                        ON CONFLICT (dataset_id, transaction_type, embedding_model, embedding_dimensions,
                                     document_format_version, document_id)
                        DO UPDATE SET category_id = EXCLUDED.category_id, source = EXCLUDED.source,
                            text = EXCLUDED.text, text_hash = EXCLUDED.text_hash, embedding = EXCLUDED.embedding""",
                        scope + (document["id"], document["category_id"], document["source"],
                                 document["text"], document["text_hash"], _vector_literal(vector)))
                request = Jsonb(current)
                cursor.execute("""UPDATE rag_documents AS stored SET category_id = requested.category_id,
                    source = requested.source
                    FROM jsonb_to_recordset(%s::jsonb)
                        AS requested(id text, category_id text, source text, text_hash text)
                    WHERE stored.dataset_id = %s AND stored.transaction_type = %s
                      AND stored.document_id = requested.id AND stored.text_hash = requested.text_hash""",
                    (request, str(dataset_id), transaction_type))
                cursor.execute("""DELETE FROM rag_documents AS stored
                    WHERE stored.dataset_id = %s AND stored.transaction_type = %s
                      AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(%s::jsonb)
                          AS requested(id text, text_hash text)
                          WHERE requested.id = stored.document_id AND requested.text_hash = stored.text_hash)""",
                    (str(dataset_id), transaction_type, request))
                cursor.execute("""WITH candidates AS MATERIALIZED (
                    SELECT stored.document_id, stored.category_id, stored.source, stored.text,
                           stored.embedding, requested.ordinal
                    FROM rag_documents AS stored
                    JOIN jsonb_to_recordset(%s::jsonb)
                        AS requested(id text, text_hash text, category_id text, ordinal integer)
                      ON stored.document_id = requested.id AND stored.text_hash = requested.text_hash
                         AND stored.category_id = requested.category_id
                    WHERE stored.dataset_id = %s AND stored.transaction_type = %s
                      AND stored.embedding_model = %s AND stored.embedding_dimensions = %s
                      AND stored.document_format_version = %s)
                    SELECT document_id, category_id, source, text FROM candidates
                    WHERE 1 - (embedding <=> %s::vector) >= %s
                    ORDER BY embedding <=> %s::vector, ordinal LIMIT 5""",
                    (request,) + scope + (_vector_literal(vectors[-1]), threshold, _vector_literal(vectors[-1])))
                return [{"id": identifier, "category_id": category, "source": source, "text": text}
                        for identifier, category, source, text in cursor.fetchall()]
