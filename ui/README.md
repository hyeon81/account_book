# 모아 목 UI

서버 없이 가계부의 화면과 주요 흐름을 확인하는 React·TypeScript·Vite 프로젝트입니다. shadcn/ui 컴포넌트를 사용하고, 거래와 AI 응답은 브라우저 메모리의 샘플 데이터로 처리합니다. API 서버, DB, OpenAI 키는 필요하지 않습니다. 새로고침하면 목 거래가 초기 상태로 돌아갑니다.

## 실행

저장소 루트의 GitHub Codespaces 또는 Dev Container는 Node.js 24, npm, 5173 포트 전달을 준비하고 `npm ci`, UI 테스트, 빌드를 실행합니다. 개발 서버는 컨테이너 터미널에서 다음과 같이 시작합니다.

```bash
bash scripts/run_mock_ui.sh
```

일반 로컬 환경에서는 저장소 루트에서 `npm --prefix ui ci`를 실행한 뒤 같은 스크립트를 사용할 수 있습니다. Windows PowerShell에서는 `cd ui; npm run dev -- --host 0.0.0.0 --port 5173 --strictPort`로 실행할 수 있습니다.

## 확인할 수 있는 흐름

- 대시보드: 월 이동, 수입·지출·차액, 카테고리별 지출, 빈 달.
- 거래 내역: 유형·카테고리 필터, 더 보기, 폼 입력·수정, 삭제 확인.
- AI 도우미: 예시 질문, 조회 답변, 추가 질문, 거래 초안 수정·확정. `오류 테스트`라고 보내면 응답 실패를 볼 수 있습니다.
- 왼쪽 아래 `목 상태 미리보기`에서 로딩·오류 화면을 확인할 수 있습니다.

직접 입력과 초안 확정은 모두 목 저장소만 바꿉니다. 실제 `/api` 요청은 보내지 않습니다.

## 검증

```bash
npm --prefix ui test
npm --prefix ui run build
npm --prefix ui run lint
```

도메인과 계산 코드는 `src/domain`, `src/application`에, 목 구현은 `src/infrastructure`에, 화면은 `src/presentation`에 있습니다. 테스트는 `tests` 아래에 같은 경로로 둡니다.
