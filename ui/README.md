# 모아 가계부 UI

서버 없이 동작하는 React·TypeScript·Vite 가계부입니다. shadcn/ui 컴포넌트를 사용합니다. 직접 입력한 거래는 브라우저의 `localStorage`에 저장되어 새로고침해도 유지됩니다. 저장소는 브라우저·출처별로 분리되며 다른 기기와 동기화되지 않습니다. API 서버, DB, OpenAI 키는 필요하지 않습니다.

## 실행

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
- 카드 문자 자동 입력: 입력 도우미의 `카드 문자 붙여넣기` 또는 거래 추가 폼에서 승인 문자 한 건을 넣으면 날짜·금액·사용처·카테고리를 채웁니다. `예시 체험`으로 확인하고 직접 수정한 뒤 저장할 수 있습니다. 실제 AI 호출은 없습니다.

거래는 빈 상태에서 시작합니다. 직접 입력과 초안 확정 모두 같은 브라우저 저장소를 바꾸며 화면의 합계에 즉시 반영됩니다. 실제 `/api` 요청은 보내지 않습니다. 브라우저 데이터를 지우면 거래도 사라지므로 중요한 기록의 장기 보관에는 사용하지 마세요.

## 검증

```bash
npm --prefix ui test
npm --prefix ui run build
npm --prefix ui run lint
```

도메인과 계산 코드는 `src/domain`, `src/application`에, 로컬 저장과 각본형 도우미는 `src/infrastructure`에, 화면은 `src/presentation`에 있습니다. 테스트는 `tests` 아래에 같은 경로로 둡니다. 향후 API·AI 호출은 인프라 경계에서 연결합니다.
