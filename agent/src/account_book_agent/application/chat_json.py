"""Exact JSON numbers for API observations, without binary float conversion."""
import json
from decimal import Decimal


def dumps(value):
    if isinstance(value, Decimal):
        if not value.is_finite(): raise ValueError("Non-finite number")
        return format(value, "f")
    if isinstance(value, dict):
        return "{" + ",".join(json.dumps(str(k), ensure_ascii=False) + ":" + dumps(v)
                              for k, v in value.items()) + "}"
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(dumps(v) for v in value) + "]"
    return json.dumps(value, ensure_ascii=False, allow_nan=False)
