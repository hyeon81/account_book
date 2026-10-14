# 로컬 가계부 UI 개발 환경

이 문서는 브라우저 저장소로 동작하는 UI의 개발 컨테이너 실행 경로와 데이터 경계를 정한다. 화면별 구성은 [UI 공통 설계](ui-design.md), 실제 UI 명령은 [UI README](../../ui/README.md)에서 확인할 수 있다.

## 개발 컨테이너

로컬 Docker 개발 서버의 실행·검증 명령은 [shadcn/ui와 개발용 Docker](shadcn-development.md)를 따른다. `docker-compose.dev.yml`은 5173 포트의 소스 변경 반영용이며, `compose.yaml`은 8080 포트의 빌드 미리보기용이다.

GitHub Codespaces 또는 Dev Containers로 저장소를 열면 `.devcontainer/devcontainer.json`이 Python, Git, Node.js 24, npm을 사용할 수 있는 환경을 준비한다. Vite 개발 서버용 `5173` 포트를 전달한다. 컨테이너 생성 뒤에는 Git 명령, Python 테스트, 문서 검증, UI 의존성 설치, UI 테스트와 빌드를 실행한다. 개발 서버는 터미널에서 직접 시작한다.

## UI 실행

개발 컨테이너 터미널에서 다음 명령으로 시작한다. 컨테이너 생성 직후에는 이미 `npm ci`가 끝나 있다. 로컬 환경에서 처음 실행할 때만 `npm --prefix ui ci`를 먼저 실행한다.

```bash
bash scripts/run_mock_ui.sh
```

실행 스크립트는 `0.0.0.0`에 바인딩하고 고정 포트 `5173`을 사용한다. 포트가 이미 사용 중이면 다른 포트로 이동하지 않고 오류를 확인한다. Codespaces에서는 전달된 포트의 정확한 호스트 이름만 Vite에 추가로 허용한다. 로컬 개발 컨테이너에서는 기본 허용 호스트를 사용한다. `docker compose up`은 8080 포트에서 빌드한 UI를 제공한다.

## 데이터와 동작 경계

- 거래는 빈 상태에서 시작해 브라우저 `localStorage`에 저장한다. 직접 입력·수정·삭제와 도우미 초안 확정은 같은 저장소를 사용하고 대시보드·거래 목록에 즉시 반영된다. 새로고침 후에도 남지만 브라우저 데이터 삭제·다른 기기에는 유지되지 않는다.
- 저장소 접근은 `ui/src/infrastructure/localLedger.ts`에 둔다. 현재 거래 자체는 서버에 저장하지 않고 브라우저에 남긴다.
- 거래 추가 폼의 **채우기**는 `/api/transaction-draft`를 호출한다. 이 API는 거래 추출 AI와 RAG 카테고리 분류를 순서대로 실행하며, 문장과 확정 거래의 최소 분류 내역을 서버로 보낸다.
- 통계 채팅 화면의 입력 도우미는 `ui/src/infrastructure/scriptedAssistant.ts`의 정해진 규칙으로 응답한다. 저장된 거래로 합계를 계산하며 OpenAI나 외부 AI를 호출하지 않는다.
- API 서버와 OpenAI 키는 거래 채우기와 카테고리 추천에 필요하다. DB와 서비스 토큰은 아직 필요하지 않다. 저장 공간이 막히거나 데이터가 손상되면 오류를 표시하고 저장 성공으로 알리지 않는다.
- React, Vite, shadcn/ui 컴포넌트와 필요한 npm 패키지는 `ui/package-lock.json`으로 고정한다. UI 구현은 로컬 컴포넌트 파일을 사용한다.

## 완료 확인

1. 개발 컨테이너에서 `git`, `node`, `npm`, `pytest`, UI 테스트와 빌드가 실행된다.
2. Vite가 `5173` 포트에서 실행되고 Codespaces 전달 포트로 접근된다.
3. 브라우저 저장소로 거래를 추가·수정·삭제하고 월별 집계에 반영하며, 새로고침 후에도 기록이 유지된다.
4. 거래 채우기와 카테고리 추천은 로컬 API 서버를 통해 동작하고, 통계 채팅 도우미는 저장된 거래를 읽어 외부 API 없이 답한다.
