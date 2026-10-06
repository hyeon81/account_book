# 상황에 맞는 규칙 기반 가계부 통계

AI가 상황에 맞는 통계 규칙을 선택하거나 초안으로 제안하고 서버가 검증된 규칙으로 계산한다. 규칙은 허용 지표·기간·비교·조건을 조합한 데이터다. 모델이 생성한 Python이나 SQL은 실행하지 않는다.

## 사용 예와 규칙 선택

“요즘 카페 지출이 늘었는지 보고 싶어”에는 최근 완료된 두 주의 카페 지출 합계를 비교하는 규칙을 제안한다. 완료되지 않은 이번 달을 지난달 전체와 비교하면 편향될 수 있으므로 같은 경과일 비교나 완료된 기간 비교를 선택하도록 묻는다. 초기 도구는 완료된 기간만 지원하고 경과일 비교는 후속 범위다.

처음에는 서버의 승인된 규칙 목록에서 선택한다. 이후 실습에서 허용 필드 조합으로 새 초안을 만든다. 재사용할 규칙은 사용자가 미리보기를 확인한 뒤 저장·활성화한다. 일회성 계산은 저장 없이 검증 후 실행한다.

## 선언형 규칙 예시

아래 수치와 ID는 교육용 예시다. 20%는 실제 사용자 예산 목표나 보편적 권고 기준이 아니다.

```json
{
  "rule_id": "weekly_cafe_growth",
  "version": 1,
  "name": "완료된 주간 카페 지출 증가",
  "metric": "sum",
  "type": "expense",
  "category_id": "cafe",
  "period": "last_complete_week",
  "comparison": "previous_complete_week",
  "condition": {
    "measure": "increase_rate_percent",
    "operator": "gte",
    "threshold": 20
  },
  "minimum_baseline_count": 2,
  "active": false
}
```

ID와 버전은 서버가 부여하며 소유자는 실행 문맥에서 결정한다. 새 초안 입력에는 식별자가 없고 서버가 생성한다. 모델이 반환한 `active: true`는 활성화 권한이 아니다.

| 필드 | 초기 허용 범위 |
| --- | --- |
| `metric` | `sum`, `count` |
| `type` | `income`, `expense` |
| `category_id` | 사용자에게 허용된 유형별 카테고리 |
| `period` | `last_complete_week`, `last_complete_month` |
| `comparison` | `previous_complete_week`, `previous_complete_month`; 기간 단위 일치 |
| `condition.measure` | `increase_rate_percent` |
| `condition.operator` | `gte`, `gt` |
| `condition.threshold` | 유한한 0 이상 1000 이하 실수인 실습 제한 |
| `minimum_baseline_count` | 1 이상 1000 이하 정수인 실습 제한 |

알 수 없는 필드, 함수, 수식 문자열과 범위 밖 값은 거절한다. 자유 수식, 중첩 조건, 예산과 예측은 후속 설계로 둔다.

## 에이전트 처리 흐름

1. `list_statistic_rules`로 활성 규칙과 승인 템플릿을 가져온다. 적합한 규칙이 없으면 초안 또는 추가 질문을 반환한다.
2. `validate_statistic_rule`이 스키마·유형·기간 조합·범위·버전을 확인한다.
3. `evaluate_statistic_rule`이 서버 기준 시각과 동일한 거래 스냅샷으로 두 기간을 집계한다.
4. 서버가 차액, 증감률, 자료 부족과 조건 충족 여부를 계산한다.
5. 에이전트는 규칙 이름·버전·기간·계산 결과·조건을 설명한다. 증가만으로 “과소비”를 단정하지 않는다.
6. 재사용할 새 규칙은 사용자가 확인한 버전만 저장한다. 수정 시 새 버전을 만들고 미확인 버전은 활성화하지 않는다.

평가 도구는 저장·외부 알림을 발생시키지 않는다. 재평가 결과에는 실행 시각과 자료 버전을 기록한다. 과거 실행을 다시 보여줄 때는 당시 규칙과 자료 버전을 사용한다.

## 계산과 결과 예시

2026년 10월 6일 기준 대상 주는 9월 28일 이상 10월 5일 미만, 비교 주는 9월 21일 이상 9월 28일 미만이다. 이전 주가 20,000원, 지난주가 30,000원이면 차액은 10,000원, 증가율은 50%다. 거래 건수는 별도로 센다.

```json
{
  "rule_id": "weekly_cafe_growth",
  "rule_version": 1,
  "status": "evaluated",
  "current_period": {"start": "2026-09-28", "end_exclusive": "2026-10-05"},
  "baseline_period": {"start": "2026-09-21", "end_exclusive": "2026-09-28"},
  "current_value": 30000,
  "baseline_value": 20000,
  "current_count": 3,
  "baseline_count": 2,
  "difference": 10000,
  "increase_rate_percent": 50,
  "unit": "KRW",
  "condition_met": true
}
```

증가율은 서버가 `100 × (current_value - baseline_value) / baseline_value`로 계산한다. 금액은 원 단위 정수, 비율은 Decimal 또는 동등한 결정적 계산을 사용한다. 조건은 반올림 전 값으로 판단하고 표시만 소수 첫째 자리로 반올림한다. `count` 규칙의 단위는 `transaction`이다.

기준 값이 0이면 증가율과 `condition_met`는 `null`, 상태는 `not_comparable`이다. 기준 건수가 최소값보다 작으면 `insufficient_data`로 처리하고 조건을 평가하지 않는다. 둘이 겹치면 `not_comparable`을 우선한다. 비교 가능할 때만 `evaluated`를 반환한다. 조건 미충족은 `false`, 조회 실패는 오류로 구분한다.

## 교육 실습과 완료 기준

고정 규칙을 모델 없이 실행해 계산을 검증한 뒤 모델 대역으로 규칙 선택을 시험한다. 마지막에 실제 모델의 초안 생성과 미리보기·확인을 연결한다. 의도 해석과 결정적 계산의 경계를 관찰하는 실습이다.

증가·감소·임계값과 같은 값·기준 0·자료 부족·빈 기간·기간 단위 혼합·삭제된 카테고리·허용되지 않은 연산을 시험한다. 같은 스냅샷과 규칙 버전의 결과는 동일해야 한다. 버전이 바뀌면 이전 승인으로 활성화할 수 없어야 한다.

화면은 두 기간, 필터, 계산 값, 임계값과 규칙 버전을 표시한다. 모델이 수치를 바꾸거나 없는 근거를 덧붙이면 차단한다. 확인 경계와 호출 제한은 [공통 에이전트 구조](agent-architecture.md)를 따른다.

## 후속 통계 알림

예약 평가와 알림 전달에는 시간대, 사용자 설정, 실행 중복 방지, 자료 부족 시 발송 정책과 해제 방법을 추가 정의한다. AI의 설명만으로 외부 메시지를 보내지 않는다. 현재는 화면과 채팅에서 결과를 제공한다.
