# 개발 규칙

이 문서는 가계부 프로젝트의 UI, API 서버, 에이전트 구현에 적용한다. 코드를 추가하거나 수정할 때 파일 크기, 클래스 배치, 의존성 방향, 테스트 구조를 같은 기준으로 유지하기 위한 규칙이다.

## 파일 크기

- 기능 개발 중에는 파일이 300줄을 넘어도 된다. **기능을 완료할 때** 해당 기능에서 추가하거나 수정한 코드, 테스트, 설정 파일이 각각 300줄 이하인지 확인한다. 빈 줄과 주석도 줄 수에 포함한다. Markdown 등 문서 파일에는 이 제한을 적용하지 않는다.
- 기능 완료 시 300줄을 넘는 파일은 책임을 기준으로 나눈다. 단순히 줄 수를 맞추기 위해 이름만 다른 파일로 분산하지 않는다.
- 생성 파일, 잠금 파일, 외부 라이브러리와 바이너리는 이 규칙의 대상에서 제외한다. 생성 결과를 손으로 분할하지 않는다.
- 개발 중간의 저장이나 커밋마다 줄 수를 검사할 필요는 없다. 기능 완료 점검에서 초과 파일을 정리한 뒤 마무리한다.

## 클래스와 파일

- `dataclass`, Pydantic 모델, SQLAlchemy 모델, 서비스 클래스, 예외 클래스 등 **직접 정의하는 클래스는 파일당 하나**만 둔다.
- 클래스명과 파일명은 대응되도록 한다. Python은 `transaction.py`에 `Transaction`, `create_transaction.py`에 `CreateTransaction`처럼 작성한다.
- 한 파일에 여러 클래스가 필요해 보이면 각 클래스를 별도 파일로 분리하고 `__init__.py`에서 필요한 이름만 다시 내보낸다.
- 함수, 상수, 타입 별칭은 책임이 분명한 모듈에 둔다. 이 규칙을 지키려고 한 줄짜리 함수를 무조건 별도 파일로 만들 필요는 없다.
- React 컴포넌트도 파일당 하나를 기본으로 하고 파일 이름을 컴포넌트 이름과 맞춘다. 컴포넌트 내부에서만 쓰는 작은 함수나 타입은 같은 파일에 둘 수 있다.

## Clean Architecture

의존성은 바깥 계층에서 안쪽 계층으로만 향한다. 핵심 거래 규칙은 HTTP, UI, DB, LLM 없이 실행할 수 있어야 한다.

| 계층 | 책임 | 의존할 수 있는 계층 |
| --- | --- | --- |
| `domain` | 거래와 금액의 불변식, 엔티티, 값 객체 | 없음 |
| `application` | 거래 등록·조회·집계 유스케이스, 저장소와 도구의 인터페이스 | `domain` |
| `infrastructure` | PostgreSQL 저장소, LiteLLM 호출, 외부 HTTP 클라이언트 등 인터페이스 구현 | `application`, `domain` |
| `presentation` | FastAPI 라우트와 요청·응답 모델, React 화면과 입력 처리 | `application`, `domain` |

- `domain`에서 FastAPI, SQLAlchemy, React, LiteLLM을 import하지 않는다.
- `application`은 구체적인 DB 세션이나 모델 SDK 대신 인터페이스에 의존한다.
- `presentation`은 유스케이스를 호출하고 결과를 표현한다. 거래 합계 계산과 저장 규칙을 화면이나 라우트에 넣지 않는다.
- `infrastructure`에서 DB 행, HTTP 응답, LLM 응답을 도메인 객체로 변환한다.
- 서비스 시작점에서 구현체를 유스케이스에 연결한다. 계층 간 순환 import를 만들지 않는다.
- API 서버와 에이전트는 서로의 `src`를 직접 import하지 않고, 정의된 HTTP 계약으로 통신한다. UI도 API 서버의 내부 Python 모듈에 의존하지 않는다.

UI의 `domain`에는 화면에서 쓰는 거래 개념과 순수 계산만 둔다. `application`은 화면 사용 사례, `infrastructure`는 API 호출, `presentation`은 React 컴포넌트를 담당한다. 서버의 거래 금액과 권한 판정은 API 서버가 최종 결정한다.

## 소스와 테스트 폴더

각 서비스는 `src`와 `tests`를 형제 폴더로 둔다. 테스트 폴더는 `src` 아래의 **상대 경로를 그대로 반영**한다. 테스트 파일은 대상 파일과 같은 이름에 Python은 `test_` 접두사를, TypeScript는 `.test.ts` 또는 `.test.tsx` 접미사를 붙인다.

```text
server/
├── pyproject.toml
├── src/
│   └── account_book_server/
│       ├── domain/transaction.py
│       ├── application/create_transaction.py
│       ├── infrastructure/postgres_transaction_repository.py
│       └── presentation/transaction_routes.py
└── tests/
    └── account_book_server/
        ├── domain/test_transaction.py
        ├── application/test_create_transaction.py
        ├── infrastructure/test_postgres_transaction_repository.py
        └── presentation/test_transaction_routes.py

agent/
├── pyproject.toml
├── src/
│   └── account_book_agent/
│       ├── domain/transaction_draft.py
│       ├── application/prepare_transaction.py
│       ├── infrastructure/litellm_client.py
│       └── presentation/chat_routes.py
└── tests/
    └── account_book_agent/
        ├── domain/test_transaction_draft.py
        ├── application/test_prepare_transaction.py
        ├── infrastructure/test_litellm_client.py
        └── presentation/test_chat_routes.py

ui/
├── src/
│   ├── domain/transaction.ts
│   ├── application/createTransaction.ts
│   ├── infrastructure/transactionApi.ts
│   └── presentation/TransactionForm.tsx
└── tests/
    ├── domain/transaction.test.ts
    ├── application/createTransaction.test.ts
    ├── infrastructure/transactionApi.test.ts
    └── presentation/TransactionForm.test.tsx
```

위 목록은 구조 예시이며 파일을 미리 만들라는 뜻은 아니다. 특정 소스 파일에 의미 있는 단위 테스트가 없으면 빈 테스트 파일을 만들지 않는다. 통합 테스트도 담당 서비스의 `tests` 아래에 두고, 대상 계층에 맞는 경로를 사용한다. 테스트는 금액 계산, 초안 확정의 중복 방지, 사용자 범위, API 계약처럼 실제 동작을 검증한다.

## 기능 완료 기준

- 기능에서 추가하거나 수정한 코드·테스트·설정 파일의 줄 수를 확인했고 각 파일이 300줄 이하이며, 클래스는 파일당 하나다.
- 새 모듈의 의존성 방향이 위 계층 규칙을 따른다.
- 새 동작에 필요한 테스트가 `src`와 대응되는 `tests` 경로에 있다.
- 해당 서비스의 테스트와 정적 검사, 빌드가 통과한다. 실행할 수 없는 검사는 변경 설명에 이유를 남긴다.
- 문서를 변경했다면 `python scripts/validate_docs.py`를 실행한다. 이 검사는 문서 간 참조와 예시의 형식을 확인하며 실제 서비스 동작까지 증명하지는 않는다.
