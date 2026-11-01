"""A period name and only the parameters required by that name."""
from dataclasses import dataclass
from .period_name import PeriodName


@dataclass(frozen=True, slots=True)
class PeriodSpec:
    name: str
    n: int | None = None
    month: str | None = None
    from_date: str | None = None
    to_date: str | None = None

    def __post_init__(self):
        PeriodName(self.name)
        expected = {
            "last_n_days": {"n"}, "month": {"month"},
            "range": {"from_date", "to_date"},
        }.get(self.name, set())
        provided = {field for field in ("n", "month", "from_date", "to_date")
                    if getattr(self, field) is not None}
        if provided != expected:
            raise ValueError("Invalid period parameters")
        if self.name == "last_n_days" and (type(self.n) is not int or not 1 <= self.n <= 365):
            raise ValueError("n must be an integer from 1 to 365")
