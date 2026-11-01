"""Ledger use cases independent of HTTP and PostgreSQL."""
import base64
import json
from uuid import uuid4

from account_book_server.domain.transaction import CATEGORIES, FIELDS, invalid, valid_date, valid_id, validate_transaction
from .transaction_repository import TransactionRepository


def encode_cursor(item):
    raw = json.dumps([item["date"], item["id"]], separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(value):
    try:
        if not isinstance(value, str) or len(value) > 512:
            invalid()
        raw = base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
        parsed = json.loads(raw)
        if not isinstance(parsed, list) or len(parsed) != 2:
            invalid()
        return (valid_date(parsed[0]), valid_id(parsed[1]))
    except (ValueError, UnicodeDecodeError):
        invalid("조회 커서를 확인해 주세요.")


def validate_filters(filters):
    if set(filters) - {"from", "to", "type", "category_id", "merchant", "limit", "cursor"}:
        invalid("조회 조건을 확인해 주세요.")
    result = dict(filters)
    for field in ("from", "to"):
        if field in result:
            valid_date(result[field])
    if "from" in result and "to" in result and result["from"] > result["to"]:
        invalid("조회 시작일과 종료일을 확인해 주세요.")
    if "type" in result and result["type"] not in ("income", "expense"):
        invalid()
    if "category_id" in result:
        if not any(c["id"] == result["category_id"] and c["type"] == result.get("type", c["type"]) for c in CATEGORIES):
            invalid("조회 카테고리를 확인해 주세요.")
    if "merchant" in result:
        if not isinstance(result["merchant"], str) or not 1 <= len(result["merchant"]) <= 200 or "\x00" in result["merchant"]:
            invalid()
    limit = result.get("limit", "100")
    if not isinstance(limit, str) or not limit.isascii() or not limit.isdecimal() or not 1 <= int(limit) <= 500:
        invalid("조회 개수는 1~500이어야 합니다.")
    result["limit"] = int(limit)
    if "cursor" in result:
        result["cursor"] = decode_cursor(result["cursor"])
    return result


class Ledger:
    def __init__(self, repository: TransactionRepository):
        self.repository = repository

    def categories(self):
        return {"items": CATEGORIES}

    def list(self, filters):
        return self.repository.list(validate_filters(filters))

    def create(self, payload):
        item = validate_transaction(payload)
        return self.repository.create({"id": str(uuid4()), **item})

    def update(self, transaction_id, changes):
        valid_id(transaction_id)
        if not isinstance(changes, dict) or not changes or set(changes) - FIELDS:
            invalid()
        # The repository locks the original row and validates the merged record.
        return self.repository.update(transaction_id, changes)

    def delete(self, transaction_id):
        self.repository.delete(valid_id(transaction_id))

    def import_items(self, payload):
        if not isinstance(payload, dict) or set(payload) != {"items"}:
            invalid()
        items = payload["items"]
        if not isinstance(items, list) or not 1 <= len(items) <= 100:
            invalid("한 번에 1~100건을 가져올 수 있습니다.")
        normalized = []
        for item in items:
            if not isinstance(item, dict) or "id" not in item:
                invalid()
            transaction_id = valid_id(item["id"])
            normalized.append({"id": transaction_id, **validate_transaction({k: v for k, v in item.items() if k != "id"})})
        if len({item["id"] for item in normalized}) != len(normalized):
            invalid("중복된 거래 ID가 있습니다.")
        return self.repository.import_items(normalized)
