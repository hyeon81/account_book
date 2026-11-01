"""Resolve names, call the read API once, and return safe observations."""
from dataclasses import asdict
from datetime import date, tzinfo
from time import monotonic
from account_book_agent.domain.resolve_period import resolve_period
from account_book_agent.domain.tools.catalog import TOOL_CATALOG
from .parse_tool_arguments import parse_tool_arguments
from .parse_tool_result import parse_tool_result
from .tool_api import ToolApi
from .tool_api_error import ToolApiError
from .tool_result import observation


class ToolExecutor:
    def __init__(self, api: ToolApi, today: date, timezone: tzinfo, clock=monotonic):
        self.api, self.today, self.timezone, self.clock = api, today, timezone, clock

    def execute(self, name, arguments, call_id):
        started = self.clock()
        def failure(code, retryable=False):
            hints = {"INVALID_ARGUMENT": "도구 인자와 기간을 확인하세요.",
                     "TOOL_NOT_ALLOWED": "이 모드에서는 사용할 수 없는 도구입니다.",
                     "NOT_FOUND": "요청한 자료가 없습니다.",
                     "TOOL_UNAVAILABLE": "도구를 사용할 수 없습니다.",
                     "INVALID_API_RESPONSE": "API 결과 형식을 확인해야 합니다."}
            return {"call_id": call_id, "ok": False,
                    "error": {"code": code, "retryable": retryable,
                              "hint": hints.get(code, hints["TOOL_UNAVAILABLE"])}}
        if not isinstance(call_id, str) or not 1 <= len(call_id) <= 100:
            return failure("INVALID_ARGUMENT")
        if not isinstance(name, str) or name not in TOOL_CATALOG:
            return failure("TOOL_NOT_ALLOWED")
        try:
            parsed = parse_tool_arguments(name, arguments)
            period_keys = ("a", "b") if name == "compare_periods" else ("period",)
            periods, parameters = {}, {}
            for key in period_keys:
                bounds = resolve_period(getattr(parsed, key), self.today, self.timezone)
                periods[key] = {"from": bounds.start.isoformat(), "to": bounds.end.isoformat()}
                for field, value in bounds.api_dates().items():
                    parameters[f"{key}_{field}" if key != "period" else field] = value
            for key, value in asdict(parsed).items():
                if key not in period_keys and value is not None: parameters[key] = value
        except (ValueError, TypeError, OverflowError, RecursionError):
            return failure("INVALID_ARGUMENT")
        try:
            raw = self.api.get(name, parameters)
        except ToolApiError as error:
            code = error.code if error.code in {"INVALID_ARGUMENT", "NOT_FOUND", "INVALID_API_RESPONSE"} else "TOOL_UNAVAILABLE"
            return failure(code, error.retryable)
        except Exception:
            return failure("TOOL_UNAVAILABLE")
        try:
            truncated = False
            if isinstance(raw, dict):
                raw = dict(raw)
                cap = {"search_transactions": getattr(parsed, "limit", 20),
                       "detect_outliers": 5}.get(name, 30)
                for key in ("items", "unassessed_categories"):
                    if isinstance(raw.get(key), list) and len(raw[key]) > cap:
                        raw[key] = raw[key][:cap]
                        truncated = True
            result = parse_tool_result(name, raw)
            elapsed = max(0, round((self.clock() - started) * 1000))
            return observation(call_id, result, periods, elapsed, truncated)
        except (ValueError, TypeError, KeyError, OverflowError, RecursionError):
            return failure("INVALID_API_RESPONSE")
