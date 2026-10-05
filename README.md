# Account Book (가계부)

수입과 지출을 기록하고 관리하기 위한 가계부 프로젝트입니다.

초기 구현은 로컬 단일 사용자용이며, AI 기능에는 OpenAI를 사용할 계획입니다.

## 현재 상태

프로젝트 초기 단계이며, 아직 애플리케이션 소스 코드와 실행 환경이 구성되지 않았습니다.

## 프로젝트 구성

```text
account_book/
├── README.md
├── scripts/
│   └── validate_docs.py
└── docs/
    ├── agent-account-book-design.md
    ├── development-rules.md
    ├── python-conventions.md
    └── api-contract.md
```

## 설계 문서

[AI 에이전트 가계부 설계 초안](docs/agent-account-book-design.md)에서 Mermaid 시스템 구성도, UI 서버·API 서버·에이전트·DB의 기술 스택, Docker Compose 구성과 환경변수 관리 계획을 확인할 수 있습니다.

[개발 규칙](docs/development-rules.md)에는 코드·테스트·설정 파일의 300줄 제한, 클래스별 파일 분리, Clean Architecture와 소스·테스트 폴더 규칙을 정리했습니다.

[Python 개발 규칙](docs/python-conventions.md)에는 패키지와 import, 타입, 예외, 로깅, 테스트 방식을 정리했습니다. [API 계약](docs/api-contract.md)에는 경로별 입력·출력과 오류 응답 규칙을 정리했습니다.

## 문서 검증

문서를 변경한 뒤 아래 명령으로 로컬 링크와 제목 앵커, 코드 블록, JSON 예시, 설계와 API 계약의 경로 일치를 확인합니다. Python 표준 라이브러리만 사용하며 `.env` 파일이나 외부 URL은 읽지 않습니다.

```bash
python scripts/validate_docs.py
```

Mermaid의 전체 문법과 외부 링크의 실제 접근 여부, 문서에 적힌 기능의 구현 여부는 이 검사 범위에 포함되지 않습니다.

## 개발 및 실행 계획

의존성 설치 방법과 실행 명령은 구현이 진행되면 이 문서에 추가합니다.
현재 실행할 수 있는 애플리케이션은 없습니다.

## 문서 업데이트

개발이 진행되면 다음 내용을 업데이트합니다.

- 구현된 기능과 사용 방법
- 사용 기술 및 필요한 개발 환경
- 설치 및 실행 방법
- 테스트 방법
- 데이터 저장 방식

## 라이선스

아직 지정되지 않았습니다.
