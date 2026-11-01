from decimal import Decimal


class FakeApi:
    def get(self, name, parameters):
        return {"payment_count": 3, "active_days": 2, "average_interval_days": Decimal("1.50"),
                "average_amount": 5000, "currency": "KRW", "basis": "confirmed_transactions"}
