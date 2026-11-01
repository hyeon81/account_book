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
