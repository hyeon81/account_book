"""Provider-independent model response, including accounted USD usage."""
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class ModelReply:
    message: dict
    cost_usd: Decimal
