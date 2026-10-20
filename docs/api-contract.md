# 가계부 API 계약 초안

이 문서는 UI·API 서버·에이전트의 목표 HTTP 계약을 정한다. 현재 실행 가능한 경로는 `GET /api/health`와 두 AI POST 경로이며, 거래 CRUD·채팅·내부 도구 경로는 후속 설계다. 실제 AI 요청·응답 예시는 [RAG 구현 문서](ai/category-rag-implementation.md)에 있다. 사용 화면과 정상 응답의 자세한 JSON 예시는 [가계부 설계 문서](agent-account-book-design.md#입력과-출력-예시)에 있다. 아래 계약은 초기 로컬 단일 사용자 버전에 적용하며, 구현 과정에서 바꾸면 두 문서를 함께 갱신한다.

## 공통 규칙

- 브라우저는 UI 서버의 같은 출처에서 `/api/...`를 호출한다. UI 서버는 이 경로만 API 서버로 전달하며 `/internal/...`은 프록시하지 않는다.
- 요청과 응답 본문은 JSON이며 금액은 양의 정수 원화다. `type`은 `income` 또는 `expense`로 표현한다.
- 거래일은 `YYYY-MM-DD`, 월은 `YYYY-MM`으로 전달한다. “오늘”과 “이번 달”은 API 서버가 전달한 Asia/Seoul 기준 시각으로 해석한다.
- 현재 구현은 로컬 단일 사용자다. 두 AI 요청의 `dataset_id`는 브라우저가 유지하는 필수 UUID이며 검색 자료 구분에만 사용한다. 인증·사용자 권한을 보장하지 않는다. 향후 인증된 서비스의 사용자 ID와 구분한다. 로그인과 다중 사용자 권한은 초기 범위 밖이다.
- 브라우저가 변경을 요청하는 경로는 JSON만 받고 요청 출처를 로컬 UI 주소와 대조한다. 초기 버전에서 다른 출처의 브라우저 요청을 허용하는 CORS 설정은 사용하지 않는다.
- 거래 또는 초안의 ID는 불투명한 문자열이다. UI는 ID의 형식이나 순서를 해석하지 않는다.
- 예시에 없는 필드는 기본적으로 거부한다. 수입·지출 종류, 금액, 카테고리, 날짜를 서버가 검증한다.

## 브라우저용 경로

| 경로 | 입력 | 성공 응답 | 주요 실패 |
| --- | --- | --- | --- |
| `GET /api/categories` | 입력 없음 | `200` 사용할 수 있는 수입·지출 카테고리 목록 | `500` 서버 오류 |
| `GET /api/transactions` | `from`, `to`, `type`, `category_id`, `limit`, `cursor` 선택 | `200` 거래 목록과 다음 커서 | `422` 잘못된 필터 |
| `POST /api/transactions` | 거래일, 유형, 금액, 통화, 카테고리, 사용처, 메모 | `201` 저장된 거래 | `422` 잘못된 필드 또는 카테고리 |
| `PATCH /api/transactions/{id}` | 변경할 거래 필드만 | `200` 수정된 거래 | `404` 없는 거래, `422` 잘못된 변경 |
| `DELETE /api/transactions/{id}` | 본문 없음 | `204` 본문 없음 | `404` 없는 거래 |
| `GET /api/summary?month=YYYY-MM` | 조회할 월 | `200` 수입·지출·차액·카테고리 합계 | `422` 잘못된 월 |
| `POST /api/chat` | `message` | `200` 답변, 거래 초안 또는 추가 질문 | `422` 빈 입력, `503` AI 서비스 장애 |
| `POST /api/drafts/{id}/confirm` | `changes`와 `Idempotency-Key` 헤더 | `200` 확정 상태와 거래 ID | `404` 없는 초안, `410` 만료, `422` 잘못된 변경 |
| `POST /api/transaction-draft` | 필수 `dataset_id` UUID, 문장, 기준 날짜, Asia/Seoul, 확정 거래의 최소 분류 내역 | `200` 저장 전 초안과 RAG 추천 또는 추가 질문 | `400` 잘못된 입력, `503` AI 사용 불가 |
| `POST /api/category-recommendation` | 필수 `dataset_id` UUID, 유형, 사용처, 메모, 같은 유형의 확정 거래 분류 내역 | `200` 추천 카테고리와 근거 또는 수동 선택 안내 | `400` 잘못된 입력, `503` AI 사용 불가 |

거래 목록의 응답은 `{ "items": [...], "next_cursor": null }` 형식을 사용한다. `limit`의 기본값과 최대값은 구현 시 정하되 무제한 조회는 허용하지 않는다. 월별 합계에는 확정된 거래만 포함한다.

`POST /api/chat`의 `kind`는 `transaction_draft`, `answer`, `clarification` 중 하나다. 초안에는 `draft`와 사용자에게 보여줄 `reply`, 조회 답변에는 서버 집계값을 담은 `summary`와 `reply`, 추가 질문에는 `reply`를 담는다. 추가 질문의 답은 UI가 원래 문장과 합쳐 완성된 `message`로 다시 보낸다. 초기 버전은 서버에 대화 이력을 저장하거나 대화 ID를 관리하지 않는다. 모델이 계산한 금액으로 서버의 집계값을 덮어쓰지 않는다.

`POST /api/transaction-draft`는 거래 추가 폼의 채우기 경로다. 서버는 먼저 거래 추출 AI로 날짜·유형·금액·사용처·메모를 만들고, 검증에 성공한 경우 같은 요청 안에서 RAG 카테고리 추천을 호출한다. 성공 응답은 `status`, `reason`, `draft`, `recommendation`, `requires_confirmation`을 포함한다. 추출이 모호하면 `needs_clarification`과 질문을 반환하고 RAG를 호출하지 않는다. API는 거래 원본을 저장하지 않는다. 검색용 최소 자료와 임베딩은 PostgreSQL·pgvector에 저장하며 거래일·금액·원문 문장은 검색 자료에서 제외한다.

`POST /api/category-recommendation`은 사용자가 카테고리 영역의 AI 추천 버튼을 누르거나 거래 채우기 후속 단계에서 사용한다. 성공 응답은 `status`, `category_id`, `reason`, `evidence_ids`, `evidence`, `requires_confirmation`을 포함한다. 추천 근거 ID는 `category:<id>` 또는 `transaction:<id>`다.

두 AI 요청의 `history`는 현재 검색 자료의 기준이다. 같은 `dataset_id`·거래 유형에서 누락된 사례는 제거하며 다른 유형은 유지한다. 빈 이력은 해당 유형의 거래 사례를 제거한다. 수정·삭제는 다음 AI 요청에 반영하고 기존 최근 100건·본문 200KB 제한을 유지한다. 수정 중인 자기 거래는 UI가 제외한다. 텍스트 해시·모델·차원·문서 형식이 같으면 벡터를 재사용하고 카테고리만 바뀌면 메타데이터만 갱신한다. 질의는 매번 임베딩하며 현재 요청의 문서 ID·내용 버전·카테고리로 제한해 pgvector 정확 코사인 검색을 수행한다. 유사도 0.25 이상 상위 5개를 사용하고 서로 다른 모델·차원을 비교하지 않는다.

DB·임베딩·생성 장애는 기존 추천 `unavailable` 상태로 안내한다. 거래 추출이 성공한 경우 초안은 유지하고 카테고리만 비운다. 응답 스키마는 유지한다. 잘못되거나 누락된 `dataset_id`는 400으로 거부한다. 두 AI 경로의 상세 오류 상태는 구현 문서가 기준이다.

초안 확인 요청의 `changes`는 빈 객체이거나 화면에서 바꾼 거래 필드만 포함한다. 서버는 확정 직전에 전체 거래를 다시 검증한다. 같은 초안에 동일한 확인 요청이 반복되면 새 거래를 만들지 않고 기존 `transaction_id`를 `200`으로 반환한다. 이미 확정된 초안에 서로 다른 변경을 요청하면 `409`를 반환한다. `Idempotency-Key`가 없으면 `422`를 반환한다.

## 오류 응답

모든 브라우저용 오류 응답은 다음 형태로 통일한다. `message`는 화면에 보여줄 수 있는 설명이며 내부 예외나 비밀값을 포함하지 않는다. `details`는 필요한 경우에만 포함한다.

```json
{
  "error": {
    "code": "INVALID_TRANSACTION",
    "message": "금액은 0보다 커야 합니다.",
    "details": { "field": "amount" }
  }
}
```

| HTTP 상태 | 의미 | 대표 오류 코드 |
| --- | --- | --- |
| `422` | 입력 형식 또는 비즈니스 검증 실패 | `VALIDATION_ERROR`, `INVALID_TRANSACTION`, `INVALID_CATEGORY` |
| `404` | 거래나 초안 ID가 없음 | `TRANSACTION_NOT_FOUND`, `DRAFT_NOT_FOUND` |
| `409` | 이미 확정된 초안에 다른 변경 요청 | `DRAFT_CONFLICT` |
| `410` | 초안 유효 기간 만료 | `DRAFT_EXPIRED` |
| `429` | 대화 요청 또는 도구 호출 한도 초과 | `RATE_LIMITED` |
| `503` | 에이전트 또는 OpenAI 호출 불가 | `AGENT_UNAVAILABLE` |
| `500` | 예상하지 못한 서버 오류 | `INTERNAL_ERROR` |

Pydantic의 기본 검증 응답도 위 형식으로 변환한다. 오류 응답의 정확한 필드와 상태 코드는 구현 테스트에서 고정한다. [FastAPI 오류 처리 문서](https://fastapi.tiangolo.com/tutorial/handling-errors/)는 요청 검증 오류와 예외 핸들러를 설명한다. AI 장애 중에도 직접 거래 등록과 서버 집계 경로는 동작해야 한다.

## 서비스 내부 계약

API 서버는 에이전트에 대화 문장, 서버가 정한 기준 시각, 로컬 사용자 문맥을 전달한다. 에이전트는 정해진 도구만 선택하고, 실제 거래 저장은 할 수 없다. 에이전트가 거래를 조회하거나 초안을 준비할 때는 API 서버의 `/internal/tools/...` 경로를 호출한다. 이 경로는 브라우저용 응답 형식과 분리한다.

서버 간 요청은 `INTERNAL_SERVICE_TOKEN`으로 인증한다. 토큰이 없거나 틀리면 `401`을 반환한다. API 서버는 내부 도구 요청에서도 허용된 도구 이름과 인자, 로컬 사용자 범위를 검증한다. Compose 네트워크 안에서 접근 가능한 것만으로 인증을 대신하지 않는다. 토큰은 UI 또는 브라우저에 전달하지 않는다.

내부 도구가 반환한 합계와 거래 목록은 API 서버가 계산하거나 조회한 값이다. 에이전트의 응답 형식이 잘못되면 API 서버가 사용자용 오류로 변환한다. 내부 요청과 응답의 구체적인 JSON 스키마는 각 도구를 구현할 때 이 문서에 추가한다.
