"""Local calendar boundaries, inclusive start and exclusive end."""
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True, slots=True)
class PeriodBounds:
    start: datetime
    end: datetime

    def api_dates(self):
        return {"from": self.start.date().isoformat(),
                "to": (self.end.date() - timedelta(days=1)).isoformat()}
