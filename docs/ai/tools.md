# 가계부 AI 공통 도구 계약

RAG 카테고리 추천, 채팅 통계, 규칙 통계와 [Plan-and-Execute](plan-and-execute.md)가
공유할 서버 도구의 설계다. 현재 도구 서버는 구현되지 않았다.
MCP 어댑터도 [동일한 계약](mcp.md)을 사용한다.

## 공통 실행 문맥

서버가 인증된 사용자 범위, 요청 ID, 기준 시각, Asia/Seoul 시간대, 허용 도구,
전체 호출 예산과 거래 스냅샷 ID를 만든다. 문맥은 모델 인자가 아니다.
스냅샷은 한 요청의 집계들에 일관된 자료를 제공하며 만료·소유자 불일치는 오류다.
MCP의 독립 호출에서는 서버가 문맥을 생성하고 요청 내 참조를 외부에 노출하지 않는다.

입력은 JSON 객체로 제한하며 필수 필드·타입·enum·길이와 실제 카테고리 권한을 검사한다.
알 수 없는 필드를 거부한다. 금액은 양의 정수 원화, 조회 범위는 시작 포함·종료 제외다.
최대 조회 기간 366일, 그룹 최대 366개, RAG 검색 결과 최대 10개를 실습 정책으로 제안한다.
함수·SQL·사용자 ID·자유 URL은 입력으로 받지 않는다.

## 도구 목록

| 도구 | 입력 | 성공 결과 | 공통 사용처 |
| --- | --- | --- | --- |
| `list_categories` | `type`: income/expense | 허용 카테고리의 ID·이름·설명·버전 | RAG, 통계 |
| `retrieve_category_evidence` | `query`: 1~500자, `type`, `top_k`: 1~10 | 근거 ID·카테고리 ID·발췌·자료 버전·점수 | RAG |
| `resolve_period` | `period`: 아래 enum | 시작·종료 제외 날짜·시간대 | 채팅, 규칙, 계획 |
| `aggregate_transactions` | 기간·유형·카테고리·지표·그룹 | 합계/건수·단위·기간·필터·자료 버전 | 채팅, 규칙, 계획 |
| `compare_aggregates` | `current_result_id`, `baseline_result_id` | 차액·증감률·건수·비교 상태 | 계획의 합계 비교 |
| `list_statistic_rules` | 빈 객체 | 승인 템플릿·사용자 활성 규칙·버전 | 규칙 |
| `validate_statistic_rule` | `rule`: 규칙 초안 객체 | 유효성·정규화 초안 또는 필드 오류 | 규칙 |
| `evaluate_statistic_rule` | `rule`: 검증 대상 규칙 객체 | 재검증 후 두 기간 집계·조건 충족·자료 버전 | 규칙 |
| `prepare_transaction` | 날짜·유형·금액·통화·카테고리·사용처·메모 | 미확정 초안·초안 ID·만료 시각 | 입력 도우미 |

`resolve_period.period`는 `last_complete_week`, `previous_complete_week`,
`last_complete_month`, `previous_complete_month` 중 하나다.
다른 상대 기간은 후속 확장 또는 추가 질문으로 처리한다.

`aggregate_transactions`는 `period_start`, `period_end_exclusive`,
`type`, `category_id`, `metric`, `group_by`를 받는다.
`metric`은 기존 `sum`, `count`에 `sum_and_count`를 추가한다.
`group_by`는 null/category/date며 비교용 집계는 null만 허용한다.
`sum_and_count` 결과는 `value`에 합계, `count`에 건수를 함께 반환한다.
기존 sum/count 호출의 `value` 의미와 단위는 유지한다.

`compare_aggregates`의 ID는 서버가 집계 결과에 부여한 불투명 ID다.
같은 문맥·사용자·스냅샷의 결과만 조회하고 동일 유형·카테고리·합계 지표·
같은 길이의 인접한 완료 주 또는 인접한 완료 월인지 검사한다.
월은 날짜 수가 달라도 같은 달 단위로 허용한다. 모델이 직접 금액을 입력하지 않는다.
증감률은 서버가 결정적으로 계산하며 표시만 소수 첫째 자리로 반올림한다.
기준 0이면 `not_comparable`과 비율 null을 반환한다.
이 도구는 계획의 합계 비교 전용이다. 규칙의 sum/count 비교는
`evaluate_statistic_rule` 내부에서 기존 규칙 계약에 따라 계산한다.

`evaluate_statistic_rule`은 이전 검증 성공을 신뢰하지 않고 실행 직전에 다시 검증한다.
기존 [규칙 계약](rule-statistics.md)의 조건·버전·자료 부족 정책을 유지한다.
초안 생성 입력에는 rule_id/version/active를 받지 않으며 저장된 규칙 실행에는
서버가 조회한 해당 사용자 버전을 사용한다.

`prepare_transaction`은 초안 저장이라는 부작용이 있어 순수 조회 도구와 구분한다.
초안 확정·삭제·규칙 저장·활성화는 사용자 확인 경로의 책임이며 모델 도구 목록에 없다.
내부 대역과 외부 MCP 모두 이 경계를 유지한다.

## 요청과 결과 예시

아래는 내부 집계 도구의 직접 호출 인자다. 값은 합성 자료를 사용한다.

```json
{
  "period_start": "2026-10-05",
  "period_end_exclusive": "2026-10-12",
  "type": "expense",
  "category_id": "cafe",
  "metric": "sum_and_count",
  "group_by": null
}
```

```json
{
  "result_id": "aggregate_example_current",
  "period_start": "2026-10-05",
  "period_end_exclusive": "2026-10-12",
  "type": "expense",
  "category_id": "cafe",
  "metric": "sum_and_count",
  "group_by": null,
  "value": 30000,
  "count": 3,
  "unit": "KRW",
  "basis": "confirmed_transactions",
  "data_version": "snapshot_example_1"
}
```

`result_id`는 실행 문맥 안에서만 재사용한다. 단순 채팅은 기존 결과에 메타데이터를
더하는 방식으로 호환성을 유지한다. 원문 거래 목록·메모는 집계 응답에 넣지 않는다.
RAG 근거는 검색 시점뿐 아니라 반환 직전에도 최신 원본과 권한을 검증한다.

## 오류와 실행 제한

| 오류 코드 | 의미 | 처리 |
| --- | --- | --- |
| `INVALID_ARGUMENT` | 잘못된 필드·기간·값 | 필드 오류를 반환, 임의 보정 금지 |
| `TOOL_NOT_ALLOWED` | 미허용 도구 또는 권한 | 실행 전 차단 |
| `REFERENCE_INVALID` | 없는 결과·다른 문맥·다른 소유자 | 자료 존재 여부를 노출하지 않는 오류 |
| `SNAPSHOT_EXPIRED` | 자료 버전 만료 | 전체 요청을 다시 시작 |
| `TOOL_UNAVAILABLE` | DB·검색 서비스 장애 | 정상 빈 결과와 구분 |
| `DEADLINE_EXCEEDED` | 시간 제한 | 이후 단계 중단 |
| `CALL_LIMIT_EXCEEDED` | 호출 예산 소진 | 이후 단계 중단 |

내부 오류는 `{"error":{"code":"INVALID_ARGUMENT","message":"조회 기간을 확인하세요.","details":{"field":"period_start"}}}`
형태로 제안한다. HTTP 사용자 응답은 [API 계약](../api-contract.md)으로 변환하고
MCP 응답은 [MCP 오류 규칙](mcp.md#오류-처리)으로 변환한다.
오류에 스택·키·토큰·원문 메모를 넣지 않는다.
요청당 6회·20초 한도를 호출 전에 확인하고 실행 중 취소도 전달한다.

## 모듈 배치와 검증

서버 application 유스케이스가 검증과 집계를 담당한다.
presentation은 내부 HTTP 및 MCP 스키마 어댑터, infrastructure는 DB·검색 구현이다.
에이전트는 내부 HTTP 계약을 호출하며 서버 Python 모듈을 직접 import하지 않는다.

합성 자료로 각 도구의 정상·빈 결과·잘못된 타입·권한·기간 경계·한도·취소를 시험한다.
특히 사용자 ID 삽입, 임의 SQL, 다른 요청의 결과 참조, 근거 삭제,
초안 도구를 통계 흐름에서 호출하는 사례를 거부해야 한다.
동일 입력·문맥의 내부 호출과 MCP 호출이 같은 도메인 결과를 반환하는 계약 테스트를
후속 구현의 완료 기준으로 둔다. 새 의존성 선정은 실제 구현 단계에서 결정한다.

