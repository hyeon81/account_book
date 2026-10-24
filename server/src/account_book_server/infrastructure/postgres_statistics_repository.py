"""Exact SQL aggregates over the canonical confirmed ledger."""
from account_book_server.domain.transaction import CATEGORIES
from .transaction_filters import transaction_filters


class PostgresStatisticsRepository:
    def __init__(self, connect):
        self.connect = connect

    def frequency(self, filters):
        where, params = transaction_filters(filters)
        with self.connect() as connection:
            row = connection.execute("""
                SELECT count(*) AS payment_count, count(DISTINCT date) AS active_days,
                       CASE WHEN count(*) > 1
                            THEN round((max(date) - min(date))::numeric / (count(*) - 1), 2)
                            ELSE NULL END AS average_interval_days,
                       round(avg(amount), 2) AS average_amount
                FROM transactions WHERE """ + where, params).fetchone()
        return dict(row)

    def compare(self, a, b, filters):
        where, params = transaction_filters(filters)
        # Both totals share one statement snapshot, including overlapping periods.
        query = """
            WITH totals AS (
                SELECT category_id,
                    coalesce(sum(amount) FILTER (WHERE date BETWEEN %s AND %s), 0) AS a_total,
                    coalesce(sum(amount) FILTER (WHERE date BETWEEN %s AND %s), 0) AS b_total
                FROM transactions WHERE """ + where + """
                    AND ((date BETWEEN %s AND %s) OR (date BETWEEN %s AND %s))
                GROUP BY category_id
            )
            SELECT category_id, a_total, b_total, b_total - a_total AS difference,
                   CASE WHEN a_total = 0 THEN NULL
                        ELSE round(100 * (b_total - a_total) / a_total, 1) END AS change_rate_percent
            FROM totals
        """
        dates = [a["from"], a["to"], b["from"], b["to"]]
        with self.connect() as connection:
            rows = connection.execute(query, dates + params + dates).fetchall()
        totals = {}
        for row in rows:
            item = dict(row)
            # PostgreSQL sum(bigint) is numeric; preserve integer totals exactly.
            for field in ("a_total", "b_total", "difference"):
                item[field] = int(row[field])
            totals[row["category_id"]] = item
        categories = sorted(c["id"] for c in CATEGORIES if c["type"] == filters["type"]
                            and ("category_id" not in filters or c["id"] == filters["category_id"]))
        return [totals.get(category, {"category_id": category, "a_total": 0, "b_total": 0,
                                      "difference": 0, "change_rate_percent": None}) for category in categories]
