"""Relative names selected by a caller; boundaries belong to code."""
from enum import StrEnum


class PeriodName(StrEnum):
    TODAY = "today"
    YESTERDAY = "yesterday"
    THIS_WEEK = "this_week"
    LAST_WEEK = "last_week"
    THIS_MONTH = "this_month"
    LAST_MONTH = "last_month"
    THIS_YEAR = "this_year"
    LAST_N_DAYS = "last_n_days"
    MONTH = "month"
    RANGE = "range"
