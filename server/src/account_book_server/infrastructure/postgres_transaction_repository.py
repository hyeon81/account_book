"""PostgreSQL confirmed ledger storage; no vectors or provider dependency."""
import hashlib
import json
import os

from account_book_server.application.ledger import encode_cursor
from account_book_server.domain.ledger_error import LedgerError
from account_book_server.domain.transaction import FIELDS, validate_transaction

COLUMNS = "id, date, type, amount, currency, category_id, merchant, memo, status"


def public_row(row):
    result = dict(row)
    result["date"] = result["date"].isoformat()
    return result


def content_hash(item):
    text = json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode()).hexdigest()


def missing():
    raise LedgerError("TRANSACTION_NOT_FOUND", "거래를 찾을 수 없습니다.")


def conflict():
    raise LedgerError("IMPORT_CONFLICT", "같은 ID의 다른 거래가 있습니다. 기존 거래를 확인해 주세요.")


class PostgresTransactionRepository:
    def __init__(self, database_url=None):
        self.database_url = database_url if database_url is not None else os.environ.get("DATABASE_URL", "")

    def _connect(self):
        import psycopg
        from psycopg.rows import dict_row
        from psycopg.conninfo import conninfo_to_dict
        if not self.database_url:
            raise RuntimeError("Ledger database is not configured")
        options = conninfo_to_dict(self.database_url).get("options", "")
        return psycopg.connect(self.database_url, connect_timeout=5,
                              options=options + " -c statement_timeout=10000 -c lock_timeout=10000", row_factory=dict_row)

    def list(self, filters):
        conditions = ["status = 'confirmed'"]
        params = []
        for field, expression in (("from", "date >= %s"), ("to", "date <= %s"),
                                  ("type", "type = %s"), ("category_id", "category_id = %s"),
                                  ("merchant", "strpos(lower(merchant), lower(%s)) > 0")):
            if field in filters:
                conditions.append(expression)
                params.append(filters[field])
        if "cursor" in filters:
            conditions.append("(date, id) < (%s::date, %s)")
            params.extend(filters["cursor"])
        limit = filters["limit"]
        params.append(limit + 1)
        with self._connect() as connection:
            rows = connection.execute(f"SELECT {COLUMNS} FROM transactions WHERE " + " AND ".join(conditions)
                                      + " ORDER BY date DESC, id DESC LIMIT %s", params).fetchall()
        items = [public_row(row) for row in rows[:limit]]
        return {"items": items, "next_cursor": encode_cursor(items[-1]) if len(rows) > limit else None}

    def _insert(self, connection, item):
        fields = ["id", "date", "type", "amount", "currency", "category_id", "merchant", "memo"]
        row = connection.execute(f"INSERT INTO transactions ({', '.join(fields)}) VALUES "
                                 "(%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING "
                                 f"RETURNING {COLUMNS}", [item[field] for field in fields]).fetchone()
        if row is None:
            conflict()
        return public_row(row)

    def create(self, transaction):
        with self._connect() as connection:
            return self._insert(connection, transaction)

    def update(self, transaction_id, changes):
        with self._connect() as connection:
            row = connection.execute(f"SELECT {COLUMNS} FROM transactions WHERE id = %s FOR UPDATE",
                                     (transaction_id,)).fetchone()
            if row is None:
                missing()
            original = public_row(row)
            merged = validate_transaction({**{key: original[key] for key in FIELDS}, **changes})
            fields = ["date", "type", "amount", "currency", "category_id", "merchant", "memo"]
            updated = connection.execute("UPDATE transactions SET " + ", ".join(f"{key} = %s" for key in fields)
                                         + f" WHERE id = %s RETURNING {COLUMNS}",
                                         [merged[key] for key in fields] + [transaction_id]).fetchone()
            return public_row(updated)

    def delete(self, transaction_id):
        with self._connect() as connection:
            result = connection.execute("DELETE FROM transactions WHERE id = %s RETURNING id", (transaction_id,))
            if result.fetchone() is None:
                missing()

    def import_items(self, items):
        imported = skipped = 0
        with self._connect() as connection:
            connection.execute("SELECT pg_advisory_xact_lock(681004225570102)")
            for item in items:
                digest = content_hash(item)
                receipt = connection.execute("SELECT content_hash FROM transaction_import_receipts WHERE source_id = %s",
                                             (item["id"],)).fetchone()
                if receipt is not None:
                    if receipt["content_hash"] != digest:
                        conflict()
                    skipped += 1
                    continue
                self._insert(connection, item)
                connection.execute("INSERT INTO transaction_import_receipts (source_id, content_hash) VALUES (%s, %s)",
                                   (item["id"], digest))
                imported += 1
        return {"imported": imported, "skipped": skipped}
