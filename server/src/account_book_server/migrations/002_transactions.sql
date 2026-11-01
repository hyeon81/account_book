CREATE TABLE transactions (
    id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,100}$'),
    date date NOT NULL,
    type text NOT NULL CHECK (type IN ('income', 'expense')),
    amount bigint NOT NULL CHECK (amount BETWEEN 1 AND 9007199254740991),
    currency text NOT NULL DEFAULT 'KRW' CHECK (currency = 'KRW'),
    category_id text NOT NULL,
    merchant text NOT NULL DEFAULT '' CHECK (length(merchant) <= 200),
    memo text NOT NULL DEFAULT '' CHECK (length(memo) <= 2000),
    status text NOT NULL DEFAULT 'confirmed' CHECK (status = 'confirmed'),
    CHECK ((type = 'income' AND category_id IN ('salary', 'other-income')) OR
           (type = 'expense' AND category_id IN ('food', 'cafe', 'shopping', 'transport', 'living', 'health')))
);
CREATE INDEX transactions_date_id ON transactions (date DESC, id DESC);
-- No foreign key: receipts survive edits and deletes, preventing retry resurrection.
CREATE TABLE transaction_import_receipts (
    source_id text PRIMARY KEY,
    content_hash text NOT NULL
);
