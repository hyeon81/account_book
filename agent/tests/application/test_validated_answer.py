from decimal import Decimal
import pytest
from account_book_agent.application.validated_answer import validated_answer


def result(reply):
    return {"reply": reply, "stop_reason": "complete", "observations": [{
        "name": "count_frequency", "arguments": {"category_id": "cafe"}, "result": {
            "ok": True, "data": {"payment_count": 3, "active_days": 2,
                                     "average_amount": Decimal("5000.50")},
            "meta": {"periods": {"period": {"from": "2026-10-01T00:00:00+09:00",
                                               "to": "2026-10-07T00:00:00+09:00"}}}}}]}


@pytest.mark.parametrize("reply", ["3건, 평균 5,000.50원입니다.", "2026-10-01부터 2026-10-06까지 3건입니다."])
def test_exact_observed_numbers_and_periods_survive(reply):
    answer = validated_answer(result(reply))
    assert answer["reply"] == reply
    assert answer["tables"][0]["rows"][0]["average_amount"] == Decimal("5000.50")
    assert answer["tables"][1]["rows"][0]["to"] == "2026-10-06"


@pytest.mark.parametrize("reply", ["30건입니다", "평균 5001원", "증가율은 99%", "2027-12-31에 8건"])
def test_invented_numbers_discard_entire_prose_and_keep_tables(reply):
    answer = validated_answer(result(reply))
    assert answer["reply"] != reply and len(answer["tables"]) == 2


def test_failure_is_not_zero_and_no_observation_cannot_support_numbers():
    data = result("0건입니다")
    data["observations"][0]["result"] = {"ok": False, "error": {"code": "TOOL_UNAVAILABLE"}}
    answer = validated_answer(data)
    assert "실패" in answer["reply"] and not answer["tables"]
    data["observations"] = []
    assert "표만" in validated_answer(data)["reply"]
