"""Bound tool observations before giving them to a future model loop."""
import json
from dataclasses import asdict


def _json_values(value):
    if isinstance(value, tuple): return [_json_values(item) for item in value]
    if isinstance(value, dict): return {key: _json_values(item) for key, item in value.items()}
    return value


def observation(call_id, result, periods, elapsed_ms, truncated=False):
    data = _json_values(asdict(result))
    meta = {"row_count": len(data["items"]) if "items" in data else 1,
            "truncated": truncated or bool(data.get("next_cursor")),
            "elapsed_ms": elapsed_ms, "periods": periods}
    envelope = {"call_id": call_id, "ok": True, "data": data, "meta": meta}
    # Decimal is preserved; str only estimates bytes conservatively (with quotes).
    def size(): return len(json.dumps(envelope, ensure_ascii=False, default=str).encode("utf-8"))
    if meta["truncated"]: meta["note"] = "목록이 일부입니다. 기간을 좁혀 조회하세요."
    while size() > 8192:
        arrays = [v for v in data.values() if isinstance(v, list) and v]
        if not arrays: raise ValueError("Result exceeds byte limit")
        max(arrays, key=len).pop()
        meta.update(truncated=True, note="결과를 8KB 이내로 잘랐습니다. 기간을 좁혀 조회하세요.")
        if "items" in data: meta["row_count"] = len(data["items"])
    return envelope
