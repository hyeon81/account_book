# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-10-13
- Primary product surfaces: 대시보드, 거래 내역, 리포트, 입력 도우미, 거래 입력 대화상자.
- Evidence reviewed: `ui/components.json`, `ui/src/components/ui`, `ui/src/presentation`, `ui/src/styles`, 사용자의 글자 확대 요청.
- Observed: shadcn/ui 기반 컴포넌트를 사용하지만 화면별 CSS 색상과 크기가 서로 달랐다.
- Direction: 사용자의 재요청에 따라 흑백 중심의 모던하고 간결한 도구형 화면으로 변경한다.

## Brand
- Personality: 차분함, 명확함, 일상적인 한국어.
- Trust signals: 저장 전 확인, 브라우저 저장 안내, 목 체험 표시.
- Avoid: 흐린 글자, 과도한 장식, 실제 AI처럼 보이는 설명.

## Product goals
- Goals: 거래 입력과 월별 소비 확인을 쉽게 한다.
- Non-goals: 실제 AI 연결, 외부 서버 전송, 저장 방식 변경.
- Success signals: 핵심 금액이 먼저 보이고 입력·확인 버튼을 쉽게 찾는다.

## Personas and jobs
- Primary personas: 개인 수입·지출을 기록하는 사용자.
- User jobs: 카드 문자와 짧은 문장 입력, 초안 수정, 소비 흐름 확인.
- Key contexts: 데스크톱과 좁은 모바일 화면.

## Information architecture
- Primary navigation: 대시보드 / 거래 내역 / 리포트 / 입력 도우미.
- Core routes/screens: 기존 페이지 구성 유지.
- Content hierarchy: 페이지 제목 → 핵심 금액 또는 입력 영역 → 보조 설명.

## Design principles
- 가독성: 본문·입력창 16px, 보조 설명 최소 14px.
- 통일성: shadcn/ui 컴포넌트와 기존 CSS 변수 사용.
- Tradeoffs: 정보 밀도보다 읽기 쉬운 여백을 우선한다.

## Visual language
- Color: 흰 배경, charcoal 버튼과 제목, zinc 보조 글자. 수입·오류 상태에만 의미 있는 색상을 쓴다.
- Typography: 기존 Geist / Malgun Gothic. 금액은 tabular-nums, 제목 28–34px.
- Spacing/layout rhythm: 8px 기준, 카드 24px, 페이지 24–40px.
- Shape/radius/elevation: 10px 카드, 8px 입력 요소, 얇은 경계선. 장식 그림자는 최소화한다.
- Motion: 기존 짧은 상태 전환만 사용.
- Imagery/iconography: 기존 Lucide 아이콘. 불필요한 장식 제거.

## Components
- Existing components: Button, Card, Badge, Input, Textarea, Select, Dialog, AlertDialog, Table, Progress.
- New/changed components: 공통 토큰, 최근 거래 카드, 통일된 Lucide 카테고리 아이콘, 채팅 예시와 폼 스타일.
- Variants and states: primary / outline / ghost, 기존 disabled·focus·error 상태 유지.
- Token/component ownership: 색상은 `ui/src/index.css`, 배치는 `ui/src/styles`.

## Accessibility
- Target standard: WCAG AA를 목표로 글자 대비와 키보드 탐색 개선.
- Keyboard/focus: 기존 Radix 포커스 처리 유지. 포커스 링을 가리지 않는다.
- Contrast/readability: 보조 글자는 `--muted-foreground`, 버튼은 44px 터치 영역 우선.
- Screen-reader semantics: 기존 label, aria-live, dialog 제목 유지.
- Reduced motion: prefers-reduced-motion에서 애니메이션을 줄인다.

## Responsive behavior
- Devices: 360px 모바일부터 데스크톱.
- Adaptations: 모바일 탐색 2열, 카드 1열, 설명과 버튼 자연스럽게 줄바꿈.
- Touch/hover: 주요 동작은 hover 없이도 확인 가능.

## Interaction states
- Loading: 기존 응답 준비 상태.
- Empty: 예시 문장 또는 거래 추가 안내.
- Error: 선명한 오류 문구와 복구 동작.
- Success: 저장 완료 상태와 알림 유지.
- Disabled: 기존 저장 조건 유지.
- Offline: 외부 AI 없이 기존 로컬 목 동작.

## Content voice
- Tone: 짧고 자연스러운 한국어.
- Terminology: 거래, 초안, 저장, 입력 도우미.
- Microcopy: 구현 용어는 피하되 목 기능임을 명확히 알린다.

## Implementation constraints
- Framework: 기존 React, TypeScript, Tailwind, shadcn/ui, Radix.
- Tokens: 기존 변수를 재사용. 새 의존성 없음.
- Performance: 외부 이미지·폰트·API 추가 없음.
- Compatibility: 기존 거래 저장·집계 동작 유지.
- Verification: 테스트·빌드·린트, 모바일과 데스크톱 화면 확인.

## Open questions
- 없음. 사용자 피드백에 따라 색상과 밀도를 조정한다.
