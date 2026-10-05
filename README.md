# Account Book (가계부)

수입과 지출을 기록하고 관리하기 위한 가계부 프로젝트입니다.

초기 구현은 로컬 단일 사용자용이며, AI 기능에는 OpenAI를 사용할 계획입니다.

현재 저장소 버전은 [`0.1.0`](VERSION)입니다. 변경 사항은 [변경 이력](CHANGELOG.md), 릴리즈 절차는 [릴리즈 문서](docs/reales.md)를 참고하세요.

## 현재 상태

프로젝트 초기 단계이며, 아직 가계부 애플리케이션 서버와 화면 코드는 없습니다. 현재 Docker Compose는 문서 검증 스크립트 실행에 사용합니다.

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
├── scripts/
│   ├── validate_docs.py
│   └── run_mock_ui.sh
├── tests/
│   └── scripts/test_validate_docs.py
├── docs/
│   ├── agent-account-book-design.md
│   ├── development-rules.md
│   ├── python-conventions.md
│   └── api-contract.md
└── ui_docs/
    ├── ui-design.md
    ├── dashboard.md
    ├── transactions.md
    ├── assistant.md
    └── mock-ui-development.md
```

## 설계 문서

[AI 에이전트 가계부 설계 초안](docs/agent-account-book-design.md)에서 Mermaid 시스템 구성도, UI 서버·API 서버·에이전트·DB의 기술 스택, Docker Compose 구성과 환경변수 관리 계획을 확인할 수 있습니다.

[개발 규칙](docs/development-rules.md)에는 코드·테스트·설정 파일의 300줄 제한, 클래스별 파일 분리, Clean Architecture와 소스·테스트 폴더 규칙을 정리했습니다.

[Python 개발 규칙](docs/python-conventions.md)에는 패키지와 import, 타입, 예외, 로깅, 테스트 방식을 정리했습니다. [API 계약](docs/api-contract.md)에는 경로별 입력·출력과 오류 응답 규칙을 정리했습니다.

[UI 공통 설계](ui_docs/ui-design.md)에서 페이지별 문서로 이동할 수 있습니다. [대시보드](ui_docs/dashboard.md), [거래 목록·입력](ui_docs/transactions.md), [AI 도우미](ui_docs/assistant.md)에 각 화면의 구조·동작·완료 기준을 정리했습니다.

## 문서 검증

문서를 변경한 뒤 아래 명령으로 `docs`와 `ui_docs`의 로컬 링크와 제목 앵커, 코드 블록, JSON 예시, 설계와 API 계약의 경로 일치를 확인합니다. Python 표준 라이브러리만 사용하며 `.env` 파일이나 외부 URL은 읽지 않습니다.

```bash
python scripts/validate_docs.py
```

Mermaid의 전체 문법과 외부 링크의 실제 접근 여부, 문서에 적힌 기능의 구현 여부는 이 검사 범위에 포함되지 않습니다.

## Docker 개발 기반

Docker Desktop이 실행 중이라면 `docker compose up --build`로 검증용 이미지를 만들고 문서 검증을 실행할 수 있습니다. 이후에는 `docker compose up`으로 같은 작업을 실행합니다. 이 명령은 아직 가계부 웹 서비스를 시작하지 않습니다.

```bash
docker compose up --build
docker compose run --rm scripts pytest
docker compose run --rm scripts python scripts/validate_docs.py
```

검증 컨테이너에는 README, 문서, 스크립트와 테스트만 읽기 전용으로 연결합니다. 실제 `.env` 파일과 API 키는 이미지와 컨테이너에 넣지 않습니다. 로컬 Python 환경에서 테스트하려면 승인된 개발 의존성을 `python -m pip install -r requirements-dev.txt`로 설치한 뒤 `pytest`를 실행합니다.

GitHub Codespaces에서는 저장소의 `.devcontainer/devcontainer.json`을 사용합니다. 개발 이미지에는 Python, `pytest`, Git, SSH 클라이언트가 들어 있으며, 작업 공간을 일반 사용자 `vscode`로 엽니다. 컨테이너 생성 후 Git 실행, 테스트, 문서 검증을 확인합니다. GitHub 인증은 Codespaces가 제공하는 방법을 사용하고 키를 이미지에 복사하지 않습니다.

서버 없는 목 UI 개발을 위해 개발 컨테이너에 Node.js 24와 npm을 추가하고 Vite용 `5173` 포트를 전달합니다. 실제 UI 프로젝트가 만들어진 뒤에는 `scripts/run_mock_ui.sh`로 Codespaces 접속 주소를 Vite에 설정해 실행합니다. 실행 명령과 목 데이터 경계는 [목 UI 개발 환경](ui_docs/mock-ui-development.md)에 정리했습니다. 현재는 UI 코드나 npm 패키지를 추가하지 않았습니다.

## 개발 및 실행 계획

애플리케이션 구현이 진행되면 서비스별 의존성과 실행 방법을 추가합니다. 현재 실행할 수 있는 가계부 애플리케이션은 없습니다.

## 문서 업데이트

개발이 진행되면 다음 내용을 업데이트합니다.

- 구현된 기능과 사용 방법
- 사용 기술 및 필요한 개발 환경
- 설치 및 실행 방법
- 테스트 방법
- 데이터 저장 방식

## 라이선스

아직 지정되지 않았습니다.
