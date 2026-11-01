# 모델 없는 에이전트 도구 구현

실습의 두 번째 feature다. 모델·채팅·SSE·화면 변경은 포함하지 않는다.
별도 agent 패키지는 API 서버의 Python 소스를 import하지 않는다. 새 의존성은 없다.

## 1. 기간 계산

`PeriodSpec`은 이름과 필요한 부가 인자만 받는다. `resolve_period`는 호출자가 주입한
사용자 현지 날짜와 `tzinfo`로 경계를 계산하는 순수 함수다. 현재 개인 가계부의 시간대는
Asia/Seoul이며 호출자가 UTC+09:00 시간대 객체를 주입한다. 다른 시간대는 해당 지역의
규칙을 가진 tzinfo를 호출자가 준비해야 한다. Windows의 시간대 DB 설치를 요구하지 않는다.

| 이름 | 경계 |
| --- | --- |
| today / yesterday | 현지 달력의 하루 |
| this_week | 이번 월요일부터 오늘 끝까지 |
| last_week | 지난 월요일부터 이번 월요일 직전까지 |
| this_month / last_month | 해당 달 전체 |
| this_year | 1월 1일부터 오늘 끝까지 |
| last_n_days | 오늘을 포함한 n일, 1~365 |
| month | 명시적인 YYYY-MM 달 전체 |
| range | 명시적인 두 날짜, 양끝 포함 |

내부는 시작 포함·종료 제외다. HTTP 호출 시 종료일을 하루 줄여
[기존 집계 API](../api-contract.md#구현된-집계-계약)의 양끝 포함 규칙으로 변환한다.
모든 기간은 366일 이내이며 잘못된 값은 보정하지 않고 거부한다.

검증: 월요일·일요일, 월말·연말·윤년, 최근 N일, 종료일 변환, 잘못된 기간을 유닛 테스트한다.

## 참고와 차이

[실습 기간 문서](https://github.com/2026-ai-service-engineering-a/account-book/blob/main/docs/ai/chat-analytics.md#5-기간--llm에게-날짜를-계산시키지-않는다)를 참고한다.
이 프로젝트의 기존 완료 주·월 전용 계획 도구와 이번 채팅용 기간 계약은 구분한다.
인증·스냅샷·새 집계 API는 이번 범위에 없다.

## 2. 읽기 도구 계약

입력·출력은 frozen dataclass이며 카탈로그가 JSON Schema를 함께 제공한다.
현재 실습 레포의 프레임워크 독립 계약을 따른다. Pydantic은 추가하지 않는다.
모든 설명은 기능과 사용하지 않을 경우의 두 줄이다. 사용자 ID·임의 URL·SQL은 인자가 아니다.
유형은 생략 시 expense이고 실제 API와 같은 카테고리 사전을 검증한다.

| 도구 | 입력 | 출력 | 실제 API 연결 |
| --- | --- | --- | --- |
| search_transactions | 기간·유형·카테고리·사용처·limit | 확정 거래 목록·다음 커서 | 거래 목록 |
| summarize_spending | 기간·유형·카테고리·사용처 | 수입·지출 합계·차액 | 미구현, 가짜 API 계약만 검증 |
| count_frequency | 기간·유형·카테고리·사용처 | 결제 건수·날짜 수·평균 | 빈도 집계 |
| compare_periods | 두 기간·유형·카테고리 | 카테고리별 합계·차액·증감률 | 기간 비교 |
| detect_outliers | 기간·유형·카테고리·사용처 | 특이 거래·판정 불가 범주와 이유 | 미구현, 가짜 API 계약만 검증 |
| get_budget_status | 기간 | 예산·지출·소진율·예상 금액 | 미구현, 가짜 API 계약만 검증 |

목록 기본 20건·최대 50건, 비교·예산 최대 30범주, 이상치 최대 5건이다.
평균과 비율의 null 및 Decimal은 보존하며 금액 계산은 API 책임이다.
비교는 현재 API처럼 명시적인 두 기간 그대로 비교하며 진행 중인 기간을 자동 절삭하지 않는다.
참고 레포의 기간 맞춤 정책과 달리 기존 집계 계약을 유지한다.

기존 tools.md의 계획·규칙·MCP 도구는 후속 설계로 남긴다. 이번 카탈로그는
통계 조회 여섯 개이며 조문 검색이나 RAG 분류 도구를 추가하지 않는다.
검증: 카탈로그 설명·스키마·입출력 모델·불변성과 null 평균을 유닛 테스트한다.

## 3. 도구 실행기와 API 어댑터

`ToolExecutor(api, today, timezone)`가 도구 이름·인자·call_id를 받아 엄격히 검증한다.
날짜 경계를 해석하고 HTTP용 종료 포함 날짜로 변환한 뒤 API 포트를 한 번 호출한다.
API 결과는 출력 스키마로 검증한 다음 불변 출력 객체로 만들고 마지막에 봉투로 변환한다.
실행기는 재시도·DB 접근·모델 호출·거래 합산을 하지 않는다.

성공 봉투는 call_id, ok=true, data, meta다. meta에는 반환 행 수, 잘림 여부,
경과 밀리초, 실제 조회한 종료 제외 기간 경계가 있다. 목록은 입력 limit을 지키고
8KB를 넘으면 목록을 줄여 truncated와 note를 함께 표시한다. 다음 커서가 있어도 잘림을 알린다.
Decimal은 그대로 보존한다. 향후 HTTP/SSE 출력에서는 정확한 숫자 직렬화가 필요하다.

실패 봉투는 call_id, ok=false, error(code, retryable, hint)다.
retryable은 상위 실행기가 참고할 정보일 뿐 이 단계에서 재시도하지 않는다.
잘못된 입력 INVALID_ARGUMENT, 미허용 도구 TOOL_NOT_ALLOWED, 없는 자료 NOT_FOUND,
API 장애 TOOL_UNAVAILABLE, 잘못된 응답 INVALID_API_RESPONSE를 구분한다.
예외 원문·API 응답 본문·거래 메모·비밀값은 오류 설명에 넣지 않는다.

`HttpToolApi`는 서버 주소를 구성 시 주입받고 아래 세 GET 경로만 호출한다.
모델 인자로 URL이나 경로를 받지 않으며 새 환경변수·Compose 서비스는 추가하지 않는다.

| 도구 | 실제 경로 |
| --- | --- |
| search_transactions | GET /api/transactions |
| count_frequency | GET /api/stats/frequency |
| compare_periods | GET /api/stats/compare |

나머지 세 도구는 실제 어댑터에서 네트워크 호출 전에 TOOL_UNAVAILABLE을 반환한다.
없는 API를 정상 빈 결과로 위장하거나 거래 목록을 모아 Python으로 합산하지 않는다.
해당 계약은 가짜 API로 입력·출력·오류를 검증하며 실제 API 구현은 별도 선행 작업이다.

검증: 여섯 도구의 가짜 API, 날짜 변환, Decimal·null 보존, 유효하지 않은 입력·응답,
API 장애 시 단일 호출, 행·바이트 잘림, 고정 HTTP 경로·URL 인코딩을 유닛 테스트한다.
