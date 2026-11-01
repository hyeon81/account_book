"""Explicit nonpersistent port double for ledger boundary tests."""
from account_book_server.domain.ledger_error import LedgerError
from account_book_server.domain.transaction import validate_transaction


class MemoryTransactions:
    def __init__(self):
        self.items = {}
        self.filters = None

    def list(self, filters):
        self.filters = filters
        return {"items": list(self.items.values()), "next_cursor": None}

    def create(self, transaction):
        item = {**transaction, "status": "confirmed"}
        self.items[item["id"]] = item
        return item

    def update(self, transaction_id, changes):
        original = self.items.get(transaction_id)
        if original is None:
            raise LedgerError("TRANSACTION_NOT_FOUND", "거래를 찾을 수 없습니다.")
        merged = {k: v for k, v in original.items() if k not in ("id", "status")}
        return self.create({"id": transaction_id, **validate_transaction({**merged, **changes})})

    def delete(self, transaction_id):
        if self.items.pop(transaction_id, None) is None:
            raise LedgerError("TRANSACTION_NOT_FOUND", "거래를 찾을 수 없습니다.")

    def import_items(self, items):
        self.imported = items
        return {"imported": len(items), "skipped": 0}
