"""Six narrow read tools, independent of HTTP, providers, and model libraries."""
from .compare_periods_input import ComparePeriodsInput
from .compare_periods_output import ComparePeriodsOutput
from .count_frequency_input import CountFrequencyInput
from .count_frequency_output import CountFrequencyOutput
from .detect_outliers_input import DetectOutliersInput
from .detect_outliers_output import DetectOutliersOutput
from .get_budget_status_input import GetBudgetStatusInput
from .get_budget_status_output import GetBudgetStatusOutput
from .input_schemas import INPUT_SCHEMAS
from .output_schemas import OUTPUT_SCHEMAS
from .search_transactions_input import SearchTransactionsInput
from .search_transactions_output import SearchTransactionsOutput
from .summarize_spending_input import SummarizeSpendingInput
from .summarize_spending_output import SummarizeSpendingOutput


INPUT_TYPES = {
    "search_transactions": SearchTransactionsInput,
    "summarize_spending": SummarizeSpendingInput,
    "count_frequency": CountFrequencyInput,
    "compare_periods": ComparePeriodsInput,
    "detect_outliers": DetectOutliersInput,
    "get_budget_status": GetBudgetStatusInput,
}
OUTPUT_TYPES = {
    "search_transactions": SearchTransactionsOutput,
    "summarize_spending": SummarizeSpendingOutput,
    "count_frequency": CountFrequencyOutput,
    "compare_periods": ComparePeriodsOutput,
    "detect_outliers": DetectOutliersOutput,
    "get_budget_status": GetBudgetStatusOutput,
}
DESCRIPTIONS = {
    "search_transactions": "기간과 필터에 맞는 확정 거래 목록을 조회한다.\n"
                           "합계나 결제 건수만 필요할 때는 이 도구를 쓰지 않는다.",
    "summarize_spending": "기간 안의 수입·지출 합계를 서버에서 조회한다.\n"
                          "결제 건수나 거래 목록만 필요할 때는 이 도구를 쓰지 않는다.",
    "count_frequency": "기간 안의 결제 건수·거래 날짜 수·평균을 조회한다.\n"
                       "금액 합계가 필요하면 이 도구 대신 summarize_spending을 쓴다.",
    "compare_periods": "두 기간의 카테고리별 금액과 증감을 조회한다.\n"
                       "한 기간의 합계만 필요할 때는 이 도구를 쓰지 않는다.",
    "detect_outliers": "서버가 판정한 특이 거래와 판정하지 못한 범주를 조회한다.\n"
                       "지출의 원인이나 미래 금액을 예측할 때는 이 도구를 쓰지 않는다.",
    "get_budget_status": "기간 안의 카테고리별 예산 소진율과 페이스를 조회한다.\n"
                         "예산을 설정하거나 거래를 수정할 때는 이 도구를 쓰지 않는다.",
}
TOOL_CATALOG = {
    name: {"description": DESCRIPTIONS[name], "permission": "read",
           "input_schema": INPUT_SCHEMAS[name], "output_schema": OUTPUT_SCHEMAS[name]}
    for name in INPUT_TYPES
}
