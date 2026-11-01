"""Canonical confirmed transaction validation."""
import re
from datetime import date

from .ledger_error import LedgerError

CATEGORIES = [
    {"id": "salary", "name": "급여", "type": "income"},
    {"id": "other-income", "name": "기타 수입", "type": "income"},
    {"id": "food", "name": "식비", "type": "expense"},
    {"id": "cafe", "name": "카페", "type": "expense"},
    {"id": "shopping", "name": "쇼핑", "type": "expense"},
    {"id": "transport", "name": "교통", "type": "expense"},
    {"id": "living", "name": "생활", "type": "expense"},
    {"id": "health", "name": "건강", "type": "expense"},
]
FIELDS = {"date", "type", "amount", "currency", "category_id", "merchant", "memo"}
MAX_AMOUNT = 9007199254740991


def invalid(message="거래 입력을 확인해 주세요."):
    raise LedgerError("VALIDATION_ERROR", message)


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        invalid("올바른 거래일을 입력해 주세요.")
    try:
        date.fromisoformat(value)
    except ValueError:
        invalid("올바른 거래일을 입력해 주세요.")
    return value


def valid_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value):
        invalid("거래 ID를 확인해 주세요.")
    return value


def validate_transaction(payload):
    if not isinstance(payload, dict) or set(payload) - FIELDS:
        invalid()
    if FIELDS - {"currency", "merchant", "memo"} - set(payload):
        invalid()
    result = {"currency": "KRW", "merchant": "", "memo": "", **payload}
    valid_date(result["date"])
    amount = result["amount"]
    if type(amount) is not int or not 1 <= amount <= MAX_AMOUNT:
        invalid("금액은 1원 이상의 안전한 정수여야 합니다.")
    if result["currency"] != "KRW":
        invalid("원화 거래만 저장할 수 있습니다.")
    if not any(item["id"] == result["category_id"] and item["type"] == result["type"] for item in CATEGORIES):
        invalid("유형에 맞는 카테고리를 선택해 주세요.")
    for field, limit in (("merchant", 200), ("memo", 2000)):
        value = result[field]
        if not isinstance(value, str) or len(value) > limit or "\x00" in value:
            invalid("사용처와 메모 길이를 확인해 주세요.")
    return result
