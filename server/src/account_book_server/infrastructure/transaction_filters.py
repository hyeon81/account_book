"""Fixed, parameterized predicates shared by listing and aggregates."""


def transaction_filters(filters):
    conditions = ["status = 'confirmed'"]
    params = []
    for field, expression in (("from", "date >= %s"), ("to", "date <= %s"),
                              ("type", "type = %s"), ("category_id", "category_id = %s"),
                              ("merchant", "strpos(lower(merchant), lower(%s)) > 0")):
        if field in filters:
            conditions.append(expression)
            params.append(filters[field])
    return " AND ".join(conditions), params
