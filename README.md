# Account Book (가계부)

수입과 지출을 기록하고 관리하기 위한 가계부 프로젝트입니다.

현재 구현은 로컬 단일 사용자용이며 AI 거래 추출·카테고리 추천에 OpenAI를 사용합니다.

현재 저장소 버전은 [`0.2.0`](VERSION)입니다. 변경 사항은 [변경 이력](CHANGELOG.md), 릴리즈 절차는 [릴리즈 문서](docs/reales.md)를 참고하세요.

## 현재 상태

브라우저에서 동작하는 가계부 UI가 있습니다. 거래 입력·조회·수정·삭제와 월별 집계는 브라우저 저장소를 사용하므로 새로고침 뒤에도 유지됩니다. Docker Compose로 UI를 실행하면 `http://localhost:8080`에서 접속할 수 있습니다. AI 채우기는 거래 추출 AI와 RAG 카테고리 분류를 순서대로 호출하고, AI 카테고리 추천은 로컬 API 서버의 RAG 검색과 OpenAI 생성으로 동작합니다. 검색 자료와 임베딩은 PostgreSQL·pgvector에 저장하고 변경되지 않은 자료의 임베딩을 재사용합니다. 거래 원본은 브라우저에 유지하며 별도 에이전트 서비스와 로그인은 후속 범위입니다.

## 프로젝트 구성

```text
account_book/
├── README.md
├── VERSION
├── CHANGELOG.md
├── AGENTS.md
├── compose.yaml
├── Dockerfile.dev
├── requirements-dev.txt
├── pytest.ini
├── .gitignore
├── .gitattributes
├── .dockerignore
├── .devcontainer/
│   └── devcontainer.json
├── ui/
│   ├── src/
│   ├── tests/
│   └── package.json
├── scripts/
│   ├── validate_docs.py
│   └── run_mock_ui.sh
├── tests/
│   └── scripts/test_validate_docs.py
└── docs/
    ├── ai/
    │   ├── README.md
    │   ├── requirements.md
    │   ├── agent-architecture.md
    │   ├── transaction-draft.md
    │   ├── category-rag.md
    │   ├── chat-statistics.md
    │   ├── rule-statistics.md
    │   └── card-message-preview.md
    ├── ui_docs/
    │   ├── ui-design.md
    │   ├── dashboard.md
    │   ├── transactions.md
    │   ├── reports.md
    │   ├── assistant.md
    │   └── mock-ui-development.md
    ├── agent-account-book-design.md
    ├── development-rules.md
    ├── python-conventions.md
    └── api-contract.md
```

## 설계 문서

[가계부 AI 설계와 교육 실습](docs/ai/README.md)에 요구사항 원문과 계획, 공통 에이전트 구조, RAG 카테고리 추천, 채팅 통계와 규칙 기반 통계를 정리했습니다. 채우기와 카테고리 추천의 실행 방법과 API는 [RAG 구현 문서](docs/ai/category-rag-implementation.md)를 참고하세요. 통계 채팅 도우미는 기존 각본형 대역입니다.

[AI 에이전트 가계부 설계 초안](docs/agent-account-book-design.md)에서 Mermaid 시스템 구성도, UI 서버·API 서버·에이전트·DB의 기술 스택, Docker Compose 구성과 환경변수 관리 계획을 확인할 수 있습니다.

[개발 규칙](docs/development-rules.md)에는 코드·테스트·설정 파일의 300줄 제한, 클래스별 파일 분리, Clean Architecture와 소스·테스트 폴더 규칙을 정리했습니다.

[Python 개발 규칙](docs/python-conventions.md)에는 패키지와 import, 타입, 예외, 로깅, 테스트 방식을 정리했습니다. [API 계약](docs/api-contract.md)에는 경로별 입력·출력과 오류 응답 규칙을 정리했습니다.

[UI 공통 설계](docs/ui_docs/ui-design.md)에서 페이지별 문서로 이동할 수 있습니다. [대시보드](docs/ui_docs/dashboard.md), [거래 목록·입력](docs/ui_docs/transactions.md), [리포트](docs/ui_docs/reports.md), [AI 도우미](docs/ui_docs/assistant.md)에 각 화면의 구조·동작·완료 기준을 정리했습니다.

## 문서 검증

문서를 변경한 뒤 아래 명령으로 `docs`의 하위 폴더까지 로컬 링크와 제목 앵커, 코드 블록, JSON 예시, 설계와 API 계약의 경로 일치를 확인합니다. Python 표준 라이브러리만 사용하며 `.env` 파일이나 외부 URL은 읽지 않습니다.

```bash
python scripts/validate_docs.py
```

Mermaid의 전체 문법과 외부 링크의 실제 접근 여부, 문서에 적힌 기능의 구현 여부는 이 검사 범위에 포함되지 않습니다.

## Docker 개발 기반

Docker Desktop이 실행 중이라면 저장소 루트에서 `docker compose up --build`로 UI와 검증용 이미지를 만들고 실행합니다. 이후에는 `docker compose up`으로 실행할 수 있습니다. 브라우저에서 `http://localhost:8080`을 열면 가계부 UI에 접속합니다. 문서 검증 컨테이너는 검증 후 종료되고 UI 컨테이너는 계속 실행됩니다. 소스 변경 후에는 `--build`를 붙여 다시 빌드하세요.

```bash
docker compose up --build
docker compose run --rm scripts pytest
docker compose run --rm scripts python scripts/validate_docs.py
```

백그라운드 실행은 `docker compose up -d --build`, 종료는 `docker compose down`을 사용합니다. UI는 기존 Node.js 의존성으로 빌드하고 Vite 미리보기 서버로 제공합니다. 8080 포트는 로컬 컴퓨터에서만 접근할 수 있습니다. UI 이미지에는 UI 소스·설정·테스트만 포함하며 실제 `.env` 파일은 넣지 않습니다.

검증 컨테이너에는 README, 문서, 스크립트와 테스트만 읽기 전용으로 연결합니다. 실제 `.env` 파일과 API 키는 이미지에 넣지 않습니다. AI API 컨테이너에는 서버용 `OPENAI_API_KEY` 환경변수를 전달합니다. 로컬 Python 환경에서 테스트하려면 승인된 개발 의존성과 서버 패키지를 설치한 뒤 `pytest`를 실행합니다. 서버의 추가 의존성은 `psycopg[binary]`입니다.

PostgreSQL은 두 Compose 구성에서 내부 서비스로 실행되고 영속 볼륨을 사용합니다. DB 상태 확인 후 `python -m account_book_server.migrate`로 버전 관리 SQL을 적용하고 API를 시작합니다. 마이그레이션은 반복 실행해도 기존 자료를 유지합니다. `DATABASE_URL`과 `POSTGRES_USER`·`POSTGRES_PASSWORD`·`POSTGRES_DB` 설정 예시는 `.env.example`에 있습니다. DB와 API 포트는 호스트에 공개하지 않습니다. 일반 종료는 볼륨을 유지하지만 볼륨 삭제 시 검색 자료와 임베딩이 사라집니다. 개발 구성과 기본 구성은 기본 프로젝트 이름이 다를 수 있어 볼륨도 분리됩니다. 같은 DB 자료를 사용하려면 두 명령 모두 동일한 `-p account-book-category-rag`를 지정하고, 5173·8080 브라우저 출처의 거래 저장소는 여전히 별개임을 유의하세요. 자세한 재사용·삭제 규칙과 실제 DB 통합 테스트 명령은 [RAG 구현 문서](docs/ai/category-rag-implementation.md)를 참고하세요.

GitHub Codespaces에서는 저장소의 `.devcontainer/devcontainer.json`을 사용합니다. 개발 이미지에는 Python, `pytest`, Git, SSH 클라이언트가 들어 있으며, 작업 공간을 일반 사용자 `vscode`로 엽니다. 컨테이너 생성 후 Git 실행, 테스트, 문서 검증을 확인합니다. GitHub 인증은 Codespaces가 제공하는 방법을 사용하고 키를 이미지에 복사하지 않습니다.

직접 입력은 서버 없이 가능한 [가계부 UI](ui/README.md)는 React·TypeScript·Vite와 shadcn/ui로 만들었습니다. 개발 컨테이너는 Node.js 24와 npm을 준비하고 UI 의존성 설치·테스트·빌드를 확인하며 `5173` 포트를 전달합니다. 컨테이너 터미널에서 `bash scripts/run_mock_ui.sh`를 실행하면 Codespaces 접속 주소를 Vite에 맞게 설정합니다. 거래는 브라우저 `localStorage`에 저장됩니다. 거래 추가 폼의 채우기와 카테고리 추천은 API 서버가 있을 때 AI를 호출하고, 통계 채팅 도우미는 각본형 대역입니다. 자세한 실행 방법과 범위는 [UI 개발 환경](docs/ui_docs/mock-ui-development.md)에 있습니다.

## 개발 및 실행 계획

가계부 UI의 거래 저장은 브라우저 밖의 데이터 영속성·동기화가 아직 없습니다. 거래 채우기와 RAG 추천 API는 PostgreSQL·pgvector 검색 저장소와 연결되어 있습니다. 브라우저는 자료 구분용 `dataset_id` UUID를 유지하고 AI 요청에 전달합니다. 이 값은 인증 수단이 아닙니다. 확정 거래 수정·삭제는 다음 AI 요청에서 같은 유형의 검색 자료에 반영합니다. 로그인·전체 거래 동기화·별도 에이전트 서비스는 후속 범위입니다.

## 문서 업데이트

개발이 진행되면 다음 내용을 업데이트합니다.

- 구현된 기능과 사용 방법
- 사용 기술 및 필요한 개발 환경
- 설치 및 실행 방법
- 테스트 방법
- 데이터 저장 방식

## 라이선스

아직 지정되지 않았습니다.
