"""Use original observations for tables; fail closed on ungrounded numbers."""
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
import re

NUMBER = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")
NUMERIC_FIELDS = {"payment_count", "active_days", "average_interval_days", "average_amount",
                  "amount", "a_total", "b_total", "difference", "change_rate_percent"}


def validated_answer(result):
    tables, numbers, dates = [], set(), set()
    failed = False
    for observation in result["observations"]:
        envelope = observation["result"]
        if not envelope["ok"]:
            failed = True
            continue
        data = envelope["data"]
        rows = data.get("items", [data])
        clean_rows = []
        for row in rows:
            clean_rows.append({k: v for k, v in row.items()
                               if v is None or isinstance(v, (str, int, float, Decimal))})
            for key, value in row.items():
                if key in NUMERIC_FIELDS and value is not None:
                    numbers.add(Decimal(str(value)))
                if key == "date" and isinstance(value, str): dates.add(value)
        tables.append({"name": observation["name"], "rows": clean_rows})
        scopes = []
        for name, period in envelope.get("meta", {}).get("periods", {}).items():
            start = datetime.fromisoformat(period["from"]).date()
            end = datetime.fromisoformat(period["to"]).date() - timedelta(days=1)
            dates.update([start.isoformat(), end.isoformat()])
            scopes.append({"period": name, "from": start.isoformat(), "to": end.isoformat(),
                           "type": observation["arguments"].get("type", "expense"),
                           **{k: v for k, v in observation["arguments"].items()
                              if k in ("type", "category_id", "merchant")},
                           "truncated": str(envelope.get("meta", {}).get("truncated", False)).lower()})
        if scopes: tables.append({"name": "applied_filters", "rows": scopes})
    reply = result["reply"]
    checked = reply
    for value in sorted(dates, key=len, reverse=True):
        checked = checked.replace(value, " ")
        parsed = datetime.fromisoformat(value)
        checked = checked.replace(f"{parsed.year}년 {parsed.month}월 {parsed.day}일", " ")
        checked = checked.replace(f"{parsed.month}월 {parsed.day}일", " ")
    try:
        valid = all(Decimal(token.replace(",", "")) in numbers for token in NUMBER.findall(checked))
    except InvalidOperation:
        valid = False
    if not valid:
        reply = "설명의 수치를 확인하지 못해 조회 결과 표만 보여드려요."
    if failed:
        reply = "일부 조회에 실패했어요. 성공한 조회 결과만 표로 보여드려요."
    return {"reply": reply, "tables": tables, "stop_reason": result["stop_reason"]}
