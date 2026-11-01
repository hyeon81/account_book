from datetime import date, datetime, timedelta, timezone
import pytest
from account_book_agent.domain.period_spec import PeriodSpec
from account_book_agent.domain.resolve_period import resolve_period

SEOUL = timezone(timedelta(hours=9), "Asia/Seoul")


@pytest.mark.parametrize("spec,start,end", [
    (PeriodSpec("today"), "2026-11-01", "2026-11-01"),
    (PeriodSpec("yesterday"), "2026-10-31", "2026-10-31"),
    (PeriodSpec("this_week"), "2026-10-26", "2026-11-01"),
    (PeriodSpec("last_week"), "2026-10-19", "2026-10-25"),
    (PeriodSpec("this_month"), "2026-11-01", "2026-11-30"),
    (PeriodSpec("last_month"), "2026-10-01", "2026-10-31"),
    (PeriodSpec("this_year"), "2026-01-01", "2026-11-01"),
    (PeriodSpec("last_n_days", n=1), "2026-11-01", "2026-11-01"),
    (PeriodSpec("last_n_days", n=3), "2026-10-30", "2026-11-01"),
    (PeriodSpec("month", month="2024-02"), "2024-02-01", "2024-02-29"),
    (PeriodSpec("range", from_date="2026-10-31", to_date="2026-11-01"), "2026-10-31", "2026-11-01"),
])
def test_named_periods(spec, start, end):
    bounds = resolve_period(spec, date(2026, 11, 1), SEOUL)
    assert bounds.api_dates() == {"from": start, "to": end}
    assert bounds.start.tzinfo is SEOUL
    assert bounds.end.hour == 0


def test_monday_and_new_year():
    assert resolve_period(PeriodSpec("this_week"), date(2026, 11, 2), SEOUL).api_dates() == {
        "from": "2026-11-02", "to": "2026-11-02"}
    assert resolve_period(PeriodSpec("last_week"), date(2026, 1, 1), SEOUL).api_dates() == {
        "from": "2025-12-22", "to": "2025-12-28"}
    assert resolve_period(PeriodSpec("last_month"), date(2026, 1, 1), SEOUL).api_dates()["from"] == "2025-12-01"


@pytest.mark.parametrize("kwargs", [{"name":"bad"}, {"name":"today","n":3},
    {"name":"last_n_days","n":True}, {"name":"last_n_days","n":0},
    {"name":"last_n_days","n":366}, {"name":"month"}])
def test_reject_bad_parameters(kwargs):
    with pytest.raises(ValueError): PeriodSpec(**kwargs)


@pytest.mark.parametrize("spec", [PeriodSpec("month",month="2026-13"),
    PeriodSpec("month",month="2026-1"),
    PeriodSpec("range",from_date="2026-11-02",to_date="2026-11-01"),
    PeriodSpec("range",from_date="2025-01-01",to_date="2026-11-01")])
def test_invalid_dates(spec):
    with pytest.raises(ValueError): resolve_period(spec,date(2026,11,1),SEOUL)


def test_clock_and_timezone_are_explicit():
    with pytest.raises(ValueError): resolve_period(PeriodSpec("today"),datetime(2026,11,1),SEOUL)
    with pytest.raises(ValueError): resolve_period(PeriodSpec("today"),date(2026,11,1),None)
    assert resolve_period(PeriodSpec("today"),date(2026,11,1),timezone.utc).start.utcoffset() == timedelta(0)
