class SyntheticApi:
    def get(self, name, parameters):
        if name == "search_transactions": return {"items": [], "next_cursor": None}
        if name == "compare_periods":
            return {"items": [{"category_id": parameters.get("category_id", "cafe"), "a_total": 10000, "b_total": 15000,
                               "difference": 5000, "change_rate_percent": 50}],
                    "currency": "KRW", "basis": "confirmed_transactions"}
        return {"payment_count": 3, "active_days": 2, "average_interval_days": 1,
                "average_amount": 5000, "currency": "KRW", "basis": "confirmed_transactions"}
