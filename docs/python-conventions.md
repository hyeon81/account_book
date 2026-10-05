# Python 개발 규칙

이 문서는 `server`와 `agent`의 Python 코드를 작성할 때 적용한다. 공통 개발 규칙과 계층 방향은 [개발 규칙](development-rules.md)을 따르며, 여기서는 패키지, 타입, 비동기 호출, 예외, 로깅, 테스트의 구체적인 작성 방법을 정한다.

## 패키지와 import

- `server/src/account_book_server/`와 `agent/src/account_book_agent/`를 각각 독립된 Python 패키지의 루트로 사용한다. 두 서비스는 서로의 패키지를 직접 import하지 않는다.
- 각 서비스의 `pyproject.toml`에 패키지 설치 방법과 테스트 설정을 둔다. 컨테이너와 테스트 환경에서 패키지를 설치해 실행하며, 작업 디렉터리나 임시 `sys.path` 변경에 의존하지 않는다.
- 패키지 내부에서는 `from account_book_server.domain.transaction import Transaction`처럼 절대 import를 사용한다. 에이전트는 `account_book_agent`를 사용한다.
- import가 순환하면 계층의 책임을 다시 나눈다. 공통 타입을 바깥 계층에 복사하거나 도메인에서 FastAPI·DB 모델을 import해 해결하지 않는다.
- `__init__.py`는 패키지 표시와 필요한 공개 이름만 담는다. 실행 부작용을 넣지 않는다.

이 구조에서 `tests`는 `src` 아래의 패키지 상대 경로를 반영한다.

```text
server/
├── pyproject.toml
├── src/account_book_server/domain/transaction.py
└── tests/account_book_server/domain/test_transaction.py

agent/
├── pyproject.toml
├── src/account_book_agent/application/prepare_transaction.py
└── tests/account_book_agent/application/test_prepare_transaction.py
```

`src`와 `tests`를 분리한 패키지 구조와 `test_*.py` 이름은 [pytest의 공식 통합 가이드](https://docs.pytest.org/en/stable/explanation/goodpractices.html)에 맞춘다. 테스트 import 방식은 `importlib`로 설정하고, 각 서비스 패키지를 설치한 상태에서 테스트한다.

## 타입과 데이터 모델

- 공개 함수와 메서드의 인자·반환값에 타입 힌트를 작성한다. 모호한 `Any`는 외부 라이브러리 경계에만 제한하고 변환 후 구체적인 타입을 사용한다.
- 도메인 데이터는 표준 라이브러리의 `dataclass` 등으로 표현한다. 금액은 원화 정수로 유지하고 유효성 규칙은 도메인에서 검사한다.
- HTTP 요청·응답은 Pydantic 모델, DB 저장 형식은 SQLAlchemy 모델로 둔다. 두 모델을 도메인 객체 대신 내부 계층 전체에 전달하지 않는다.
- 한 파일에는 직접 정의한 클래스 하나만 둔다. Pydantic 요청 모델과 응답 모델도 각각 별도 파일에 둔다.
- 날짜만 필요한 거래일은 `date`, 절대 시각은 시간대가 있는 `datetime`을 사용한다. 상대 날짜 해석은 API 서버가 전달한 Asia/Seoul 기준 시각을 사용한다.

## 유스케이스와 입출력

- 라우트는 요청 모델을 검증하고 유스케이스를 호출한 뒤 응답 모델로 변환한다. 거래 저장과 집계 규칙은 라우트에 두지 않는다.
- DB 트랜잭션 범위는 유스케이스 단위로 정한다. 초안 확정과 거래 생성, 중복 방지 기록은 함께 성공하거나 함께 실패해야 한다.
- 저장소와 외부 도구는 `application`의 인터페이스를 `infrastructure`에서 구현한다. 테스트는 유스케이스의 인터페이스를 대체해 도메인 동작을 검증한다.
- API 서버와 에이전트 간 HTTP, DB, OpenAI 호출에는 명시적인 시간 제한을 둔다. 비동기 라우트에서 동기 네트워크·DB 호출로 이벤트 루프를 막지 않는다. 사용하는 라이브러리의 비동기 지원에 맞춰 호출 방식을 선택한다.
- 모델이 반환한 텍스트와 도구 인자는 신뢰하지 않는 입력으로 취급한다. Pydantic 검증을 통과해도 금액, 카테고리, 초안 상태 등 비즈니스 규칙은 API 서버에서 다시 검사한다.

## 예외와 로깅

- `domain`과 `application`은 HTTP 상태 코드나 FastAPI 예외를 알지 못한다. 의미 있는 도메인 예외를 만들고, `presentation`에서 [API 계약](api-contract.md)의 오류 응답으로 변환한다.
- 외부 장애를 정상적인 빈 결과로 바꾸지 않는다. OpenAI 호출 실패는 대화 기능의 오류로 반환하되 직접 거래 등록과 집계는 계속 사용할 수 있게 한다.
- 예상하지 못한 예외는 서버에서 기록하고 UI에는 내부 상세 정보를 노출하지 않는다.
- 로그에는 요청 ID, 서비스 이름, 오류 코드처럼 문제를 찾는 데 필요한 정보만 남긴다. API 키, 내부 토큰, 전체 거래 내역과 대화 원문은 기록하지 않는다.
- `print()`는 예제나 로컬 진단에만 사용하고 서비스 실행 로그는 Python 로깅을 사용한다.

## 테스트와 기능 완료 확인

- 단위 테스트는 같은 상대 경로의 `tests`에 둔다. 외부 OpenAI 호출은 모의 구현으로 대체해 키나 네트워크 없이 실행한다.
- DB 저장, 마이그레이션, HTTP 계약은 경계가 실제로 이어지는 통합 테스트로 확인한다. 테스트가 실제 사용자 데이터나 로컬 DB 볼륨을 수정하지 않도록 별도 테스트 DB를 사용한다.
- 금액 계산, 월 경계, 초안 확정 재시도, 잘못된 모델 출력처럼 결과가 달라질 수 있는 사례를 우선 테스트한다. 구현을 그대로 따라 쓰는 테스트는 피한다.
- 기능을 마칠 때 두 Python 서비스의 테스트와 정적 검사 결과를 확인한다. 구체적인 검사 도구와 명령은 구현 시 `pyproject.toml`과 README에 고정한다.
