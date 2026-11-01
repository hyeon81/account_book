"""Pure calendar calculations: no clock, IO, model or implicit timezone."""
import re
from datetime import date, datetime, time, timedelta, tzinfo
from .period_bounds import PeriodBounds
from .period_spec import PeriodSpec


def _date(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError("Use YYYY-MM-DD")
    return date.fromisoformat(value)


def _next_month(day):
    return date(day.year + (day.month == 12), day.month % 12 + 1, 1)


def resolve_period(spec: PeriodSpec, today: date, timezone: tzinfo) -> PeriodBounds:
    if type(today) is not date or not isinstance(timezone, tzinfo):
        raise ValueError("Inject a local date and timezone")
    tomorrow = today + timedelta(days=1)
    monday = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    match spec.name:
        case "today": start, end = today, tomorrow
        case "yesterday": start, end = today - timedelta(days=1), today
        case "this_week": start, end = monday, tomorrow
        case "last_week": start, end = monday - timedelta(days=7), monday
        case "this_month": start, end = month_start, _next_month(month_start)
        case "last_month":
            start = (month_start - timedelta(days=1)).replace(day=1)
            end = month_start
        case "this_year": start, end = date(today.year, 1, 1), tomorrow
        case "last_n_days": start, end = today - timedelta(days=spec.n - 1), tomorrow
        case "month":
            if not isinstance(spec.month, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}", spec.month):
                raise ValueError("Use YYYY-MM")
            start = _date(spec.month + "-01")
            end = _next_month(start)
        case "range": start, end = _date(spec.from_date), _date(spec.to_date) + timedelta(days=1)
        case _: raise ValueError("Unknown period")
    if start >= end or (end - start).days > 366:
        raise ValueError("Period must contain 1 to 366 days")
    return PeriodBounds(datetime.combine(start, time.min, timezone),
                        datetime.combine(end, time.min, timezone))
