# shadcn/ui와 개발용 Docker

## 요청 원문

```text
UI는 전체적으로

https://ui.shadcn.com/

이걸 적용해주도록 해. feature 만들고 진행하고,

docker-compose.dev.yml 을 통해서 개발용 docker
compose 를 세팅해줘.
```

## 작업 계획

1. `develop`에서 `feature/shadcn-dev-compose`를 만들고 기존 기능 커밋을 이어받는다.
2. 기존 shadcn/ui 설정과 입력 컴포넌트를 유지하며 화면 공통 버튼·카드·표·진행 막대에 적용한다.
3. 별도 개발용 Compose에서 Vite를 실행하고 소스 변경을 즉시 반영한다.
4. UI 테스트·빌드·Python 테스트·문서 검사와 Docker 실행을 검증하고 작업 단위별로 커밋한다.

## UI 기준

[shadcn/ui Vite 안내](https://ui.shadcn.com/docs/installation/vite)를 기준으로 `ui/components.json`의 `radix-nova` 스타일, Tailwind CSS와 `@/components/ui` 컴포넌트를 사용한다. 기존 녹색 테마와 거래 동작을 유지한다. 컴포넌트 소스는 저장소 안에서 관리하며 새 패키지를 추가하지 않는다.

## 개발용 Compose

저장소 루트에서 실행한다. Docker Desktop이 실행 중이어야 한다.

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

[개발 화면](http://localhost:5173)에 접속한다. 기존 `compose.yaml`의 8080 빌드 미리보기와 다른 개발 서버다. 저장소 출처가 달라 브라우저에 저장한 거래는 포트별로 분리된다.

소스·테스트·설정 파일만 읽기 전용으로 연결하며 컨테이너 안에 설치한 Linux 의존성을 사용한다. 호스트 `node_modules`나 비밀 파일은 연결하지 않는다. Windows에서도 변경을 감지하도록 폴링을 활성화한다. 패키지 또는 잠금 파일을 변경했다면 `up -d --build`를 다시 실행한다.

```bash
docker compose -f docker-compose.dev.yml exec ui npm test
docker compose -f docker-compose.dev.yml exec ui npm run build
docker compose -f docker-compose.dev.yml exec ui npm run lint
docker compose -f docker-compose.dev.yml run --rm scripts
docker compose -f docker-compose.dev.yml run --rm scripts pytest
docker compose -f docker-compose.dev.yml down
```

`scripts`는 검증용 프로필에 있어 기본 실행에서는 시작하지 않는다. 명시적인 `run scripts`로 실행한다. 종료 명령은 브라우저 저장 거래를 지우지 않는다.

설정 근거: [Docker 개발 컨테이너와 의존성 분리](https://docs.docker.com/compose/how-tos/file-watch/), [Vite 서버 설정](https://vite.dev/config/server-options.html).
