CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS rag_documents (
    dataset_id uuid NOT NULL,
    transaction_type text NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    embedding_model text NOT NULL,
    embedding_dimensions integer NOT NULL CHECK (embedding_dimensions BETWEEN 1 AND 16000),
    document_format_version integer NOT NULL,
    document_id text NOT NULL,
    category_id text NOT NULL,
    source text NOT NULL CHECK (source IN ('category', 'transaction')),
    text text NOT NULL,
    text_hash text NOT NULL,
    embedding vector NOT NULL,
    PRIMARY KEY (dataset_id, transaction_type, embedding_model, embedding_dimensions,
                 document_format_version, document_id),
    CHECK (vector_dims(embedding) = embedding_dimensions)
);
