"""Serialize SQL decimals as exact JSON numbers without a float conversion."""
import json
from decimal import Decimal


def encode_json(value):
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ValueError("Non-finite JSON number")
        return format(value, "f")
    if isinstance(value, dict):
        return "{" + ",".join(json.dumps(key, ensure_ascii=False) + ":" + encode_json(item)
                              for key, item in value.items()) + "}"
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(encode_json(item) for item in value) + "]"
    return json.dumps(value, ensure_ascii=False, allow_nan=False)
