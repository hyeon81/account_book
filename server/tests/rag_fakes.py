"""Deterministic retrieval double for provider/use-case unit tests only."""
from account_book_server.application.category_rag import CategoryRag, _vectors

DATASET_ID = "00000000-0000-4000-8000-000000000001"

class MemoryVectorStore:
    def retrieve(self, provider, documents, query_text, dataset_id, transaction_type, threshold):
        vectors = _vectors(provider.embed([item["text"] for item in documents] + [query_text]), len(documents) + 1)
        scored = [(sum(a * b for a, b in zip(vector, vectors[-1])), i)
                  for i, vector in enumerate(vectors[:-1])]
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [documents[i] for score, i in scored[:5] if score >= threshold]

def category_rag(provider, threshold=0.25):
    return CategoryRag(provider, MemoryVectorStore(), threshold)
