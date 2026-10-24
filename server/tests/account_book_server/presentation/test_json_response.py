"""Exact numeric JSON remains compatible with existing response values."""
import json
from decimal import Decimal

import pytest

from account_book_server.presentation.json_response import encode_json


def test_decimal_numbers_nested_in_existing_response_values():
    payload = {"한글\"": [Decimal("9007199254740990.50"), None, True, 1, "line\n"]}
    assert json.loads(encode_json(payload), parse_float=Decimal) == payload


def test_nonfinite_number_is_not_json():
    with pytest.raises(ValueError):
        encode_json(Decimal("NaN"))
