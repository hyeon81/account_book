# 모아 가계부 UI

서버 없이 동작하는 React·TypeScript·Vite 가계부입니다. shadcn/ui 컴포넌트를 사용합니다. 직접 입력한 거래는 브라우저의 `localStorage`에 저장되어 새로고침해도 유지됩니다. 저장소는 브라우저·출처별로 분리되며 다른 기기와 동기화되지 않습니다. 직접 입력에는 API 서버, DB, OpenAI 키가 필요하지 않습니다. AI 채우기와 카테고리 추천에는 RAG API 서버, PostgreSQL·pgvector와 서버용 OpenAI 키가 필요합니다. Compose는 이 서비스를 함께 실행합니다.

## 실행

개발 중에는 저장소 루트에서 `docker compose -f docker-compose.dev.yml up -d --build`를 실행하고 `http://localhost:5173`에 접속합니다. 소스 변경이 즉시 반영됩니다. 컨테이너 테스트·빌드와 종료 방법은 [개발용 Docker 안내](../docs/ui_docs/shadcn-development.md)를 참고하세요.

Docker Desktop을 켠 뒤 저장소 루트에서 `docker compose up --build`를 실행하고 `http://localhost:8080`에 접속합니다. 이후에는 `docker compose up`으로 실행할 수 있고, UI 소스를 변경했다면 `--build`로 다시 빌드합니다. 백그라운드 실행은 `docker compose up -d --build`, 종료는 `docker compose down`입니다. Docker에서는 빌드한 UI를 Vite 미리보기 서버로 제공합니다.

저장소 루트의 GitHub Codespaces 또는 Dev Container는 Node.js 24, npm, 5173 포트 전달을 준비하고 `npm ci`, UI 테스트, 빌드를 실행합니다. 개발 서버는 컨테이너 터미널에서 다음과 같이 시작합니다.

```bash
bash scripts/run_mock_ui.sh
```

일반 로컬 환경에서는 저장소 루트에서 `npm --prefix ui ci`를 실행한 뒤 같은 스크립트를 사용할 수 있습니다. Windows PowerShell에서는 `cd ui; npm run dev -- --host 0.0.0.0 --port 5173 --strictPort`로 실행할 수 있습니다.

## 확인할 수 있는 흐름

- 대시보드: 월 이동, 저장된 거래의 수입·지출·차액과 카테고리별 지출.
- 리포트: 월별 요약, 카테고리·주차별 지출, 전월 비교와 예시 체험. 예시는 저장되지 않습니다. [리포트 UI](../docs/ui_docs/reports.md) 참조.
- 거래 내역: 유형·카테고리 필터, 더 보기, 폼 입력·수정, 삭제 확인.
- 입력 도우미: 각본형 문장 처리, 저장된 거래 조회, 거래 초안 수정·확정. `오류 테스트`라고 보내면 실패 화면을 볼 수 있습니다.
- 거래 추가 폼의 채우기: 카드 문자 또는 `오늘 오후 3시에 카페에서 5천원 썼어`를 입력하고 채우기를 누르면 거래 추출 AI → RAG 카테고리 추천을 순서대로 호출합니다. 사용자가 확인해 저장합니다.
- 카테고리 단독 추천: 거래 입력·수정 폼의 AI 버튼으로 현재 사용처·메모의 카테고리만 추천받을 수 있습니다. 수동 입력도 계속 사용할 수 있습니다. 일반 통계 채팅 도우미는 각본형 대역입니다.

거래는 빈 상태에서 시작합니다. 직접 입력과 초안 확정 모두 같은 브라우저 저장소를 바꾸며 화면의 합계에 즉시 반영됩니다. 채우기와 카테고리 AI 버튼은 실제 `/api` 요청을 보냅니다. 거래 원본은 서버로 전체 동기화하지 않습니다. 브라우저 데이터를 지우면 거래도 사라지므로 중요한 기록의 장기 보관에는 사용하지 마세요.

## 검증

```bash
npm --prefix ui test
npm --prefix ui run build
npm --prefix ui run lint
```

도메인과 계산 코드는 `src/domain`, `src/application`에, 로컬 저장과 각본형 도우미는 `src/infrastructure`에, 화면은 `src/presentation`에 있습니다. 테스트는 `tests` 아래에 같은 경로로 둡니다. 실제 AI 요청과 자료 구분 ID도 인프라 경계에서 처리합니다.

## AI 카테고리 추천

거래 입력·수정 폼의 AI 버튼으로 RAG 카테고리 추천을 받습니다. 사용처 또는 메모가 필요하며 추천은 수정 후 저장합니다. 서버 구성은 [RAG 실행 문서](../docs/ai/category-rag-implementation.md)를 참고하세요. 로컬 UI만 실행할 경우 API 주소는 기본 localhost:8000이고, 변경은 API_PROXY_TARGET 환경변수로 지정합니다.

브라우저는 자료 구분 UUID를 `localStorage`에 유지하고 두 AI 요청의 필수 `dataset_id`로 전달합니다. 이 값은 인증 토큰이 아닙니다. 현재 확정 이력은 최근 100건·요청 크기 제한 안에서 전달하며 수정 중인 자기 거래는 제외합니다. 같은 자료 구분·유형의 수정·삭제는 다음 AI 요청 때 서버 검색 자료에 반영됩니다. 거래 원본의 금액·날짜는 카테고리 검색 자료로 저장하지 않습니다. 변경되지 않은 문서의 임베딩은 DB에서 재사용하고 질의만 매번 임베딩합니다. DB나 AI 장애가 나도 직접 입력·저장은 유지하며, 추출에 성공한 거래 필드는 남겨 둡니다.
