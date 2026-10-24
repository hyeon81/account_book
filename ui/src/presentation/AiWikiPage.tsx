import { useEffect, useRef } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, Layers3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import '../styles/ai-wiki.css'

type Props = {
  section: string
  onSectionChange: (section: string) => void
  onAssistant: () => void
}

type Topic = {
  id: string
  title: string
  subtitle: string
  area: string
  agent: string
  example: string
  steps: string[]
  tools: string[]
  boundary: string
  notes: string[]
  source: string
}

const topics: Topic[] = [
  {
    id: 'category-rag', title: 'RAG 카테고리 추천', subtitle: '관련 사례를 찾고, 근거를 바탕으로 분류해요.',
    area: '거래 추가·수정 폼 · 채우기와 카테고리 추천', agent: 'API 서버의 거래 추출 → RAG 분류',
    example: '“어제 달빛커피에서 라떼 5,500원” → 카페 추천과 분류 근거',
    steps: ['채우기를 누르면 거래 추출 AI가 거래 필드를 채웁니다. 수동 입력 후 카테고리만 추천받을 수도 있습니다.', '브라우저의 자료 구분 ID와 현재 확정 이력으로 검색 자료를 동기화합니다.', '변경 자료만 임베딩하고 PostgreSQL·pgvector에서 코사인 검색을 수행합니다.', '분류 AI가 근거를 바탕으로 추천하고 서버가 후보·근거를 검증합니다. 사용자가 확인한 후 저장합니다.'],
    tools: ['list_categories', 'retrieve_category_evidence', 'prepare_transaction'],
    boundary: '추천은 거래 확정이 아닙니다. 확인한 거래 원본은 개인 서버의 PostgreSQL에 저장합니다. 자료 구분 ID는 인증이나 접근 권한을 보장하지 않습니다.',
    notes: ['RAG는 관련 자료를 검색해 모델의 답변에 사용하는 방식입니다. 사용자 수정 때마다 모델을 재학습하는 방식은 아닙니다.', '변경 없는 문서의 임베딩은 DB에서 재사용합니다. 수정·삭제는 다음 AI 요청에서 반영하며 금액·날짜·원문 메시지는 검색 DB에 저장하지 않습니다.', '유사도는 정답 확률이 아닙니다. 근거가 없거나 조회에 실패하면 직접 선택합니다. 추출에 성공한 거래 필드는 유지합니다.'],
    source: 'category-rag.md · category-rag-implementation.md · tools.md',
  },
  {
    id: 'chat-statistics', title: '채팅 통계 조회', subtitle: '자연어 질문을 기간과 지표로 바꿔요.',
    area: '입력 도우미 · 통계 질문', agent: '의도 해석과 도구 호출 에이전트',
    example: '“저번 주 카페 결제는 몇 건이야?” → 적용 기간과 기록된 결제 건수',
    steps: ['질문에서 기간·카테고리·수입/지출·합계/건수를 추출합니다.', '서버가 Asia/Seoul 기준으로 완료된 주 또는 월을 확정합니다.', '집계 도구가 사용자 범위의 확정 거래를 계산합니다.', '에이전트가 기간·필터·단위를 설명하고 서버가 숫자를 대조합니다.'],
    tools: ['list_categories', 'resolve_period', 'aggregate_transactions'],
    boundary: '금액과 건수는 서버가 계산합니다. 모델은 거래를 직접 합산하거나 SQL을 실행하지 않습니다.',
    notes: ['카페 결제 건수는 방문 횟수와 다릅니다. 같은 날 두 거래를 임의로 하나의 방문으로 합치지 않습니다.', '“저번 주”와 “지난 7일”은 다릅니다. “요즘”처럼 모호한 기간은 먼저 확인합니다.', '기록이 없으면 정상 0건입니다. 조회 장애는 오류로 표시하며 0건으로 바꾸지 않습니다.'],
    source: 'chat-statistics.md · tools.md',
  },
  {
    id: 'rule-statistics', title: '규칙 기반 통계', subtitle: '상황에 맞는 규칙을 제안하고 같은 기준으로 계산해요.',
    area: '대시보드의 규칙 통계 안내 · 후속 규칙 미리보기', agent: '규칙 선택·초안 제안 에이전트',
    example: '“카페 지출이 늘었는지 보고 싶어” → 완료된 두 주의 증가율 비교',
    steps: ['서버의 승인 템플릿과 사용자 활성 규칙을 조회합니다.', '에이전트가 규칙을 선택하거나 허용 필드로 초안을 제안합니다.', '서버가 규칙을 검증하고 실행 직전 다시 검증합니다.', '같은 자료 버전에서 두 기간을 계산하고 결과와 조건 충족 여부를 설명합니다.'],
    tools: ['list_statistic_rules', 'validate_statistic_rule', 'evaluate_statistic_rule'],
    boundary: '규칙 평가는 저장이나 알림 발송을 하지 않습니다. 규칙 저장·활성화는 사용자가 확인한 버전만 허용합니다.',
    notes: ['규칙은 기간·지표·비교·조건을 조합한 데이터입니다. 모델이 만든 코드나 자유 수식을 실행하지 않습니다.', '예시의 증가율 20%는 교육용 조건이며 소비 권고가 아닙니다. 증가만으로 과소비를 단정하지 않습니다.', '기준 금액 0은 비교 불가, 기준 건수 부족은 자료 부족으로 표시합니다. 예약 평가와 외부 알림은 후속 설계입니다.'],
    source: 'rule-statistics.md · tools.md',
  },
  {
    id: 'plan-and-execute', title: 'Plan-and-Execute', subtitle: '여러 단계의 질문은 계획을 검증한 다음 실행해요.',
    area: '대시보드의 주간 비교 안내 · 후속 입력 도우미 복합 질문', agent: 'Planner → 서버 검증 → Executor → 설명',
    example: '“지난주 카페 지출을 그 전 주와 비교해서 금액과 결제 건수를 알려줘.”',
    steps: ['Planner가 허용 도구와 의존 관계를 담은 계획을 제안합니다.', '서버가 단계 수·도구·입력·참조 관계를 검증합니다.', 'resolve_period를 두 번 호출해 완료된 두 주를 확정합니다.', 'aggregate_transactions를 각 기간에 호출해 합계와 건수를 구합니다.', 'compare_aggregates가 서버에 저장된 두 결과를 비교합니다.', '검증된 수치로 설명합니다. 오류가 나면 다음 단계를 중단합니다.'],
    tools: ['resolve_period × 2', 'aggregate_transactions × 2', 'compare_aggregates'],
    boundary: '계획은 권한이 아닙니다. 사용자 ID·SQL·코드·외부 URL·쓰기 도구는 허용하지 않으며 거래를 변경하지 않습니다.',
    notes: ['2026년 10월 13일 기준 예시: 대상 10월 5~11일, 비교 9월 28일~10월 4일. 같은 거래 스냅샷을 사용합니다.', '합성 자료: 대상 30,000원·3건, 비교 20,000원·2건 → 10,000원 증가·50% 증가. 결제 건수 기준입니다.', '도구 호출은 요청당 최대 6회, 전체 제한은 20초로 설계합니다. 기준 0이면 비율을 표시하지 않습니다.', 'ReAct는 관찰에 따라 다음 행동을 선택하는 반복 방식입니다. 이 사례는 순서가 정해져 있어 계획을 먼저 검증합니다.'],
    source: 'plan-and-execute.md · agent-architecture.md',
  },
  {
    id: 'tools', title: '공통 도구', subtitle: '여러 에이전트가 같은 검증과 계산을 재사용해요.',
    area: '입력·추천·통계·비교가 공유하는 서버 경계', agent: '에이전트의 요청 → 서버 유스케이스',
    example: '기간 계산과 거래 집계는 채팅·규칙·계획 흐름에서 같은 계약을 사용합니다.',
    steps: ['서버가 인증 사용자·기준 시각·시간대·호출 예산·자료 버전을 정합니다.', '입력 필드·타입·허용 값·카테고리 권한을 검사합니다.', '검색·기간 계산·집계·규칙 평가 등 승인된 동작을 실행합니다.', '기간·단위·자료 버전이 포함된 결과 또는 구분된 오류를 반환합니다.'],
    tools: ['list_categories', 'retrieve_category_evidence', 'resolve_period', 'aggregate_transactions', 'compare_aggregates', 'list_statistic_rules', 'validate_statistic_rule', 'evaluate_statistic_rule', 'prepare_transaction'],
    boundary: 'prepare_transaction은 미확정 초안을 준비하는 도구입니다. 거래 확정·삭제와 규칙 저장·활성화는 모델 도구 목록에 없습니다.',
    notes: ['사용자 ID는 모델 인자로 받지 않고 서버 실행 문맥에서 결정합니다. 임의 SQL·함수·자유 URL은 거부합니다.', '조회 범위는 시작 포함·종료 제외이며 금액은 정수 원화입니다. 최대 조회 기간 366일을 실습 정책으로 제안합니다.', '다른 요청의 결과 참조와 만료된 자료 버전은 차단합니다. 조회 장애·권한 오류·빈 결과를 구분합니다.'],
    source: 'tools.md · agent-architecture.md',
  },
  {
    id: 'mcp', title: '외부 AI와 MCP', subtitle: '외부 AI 호스트도 같은 서버 도구에 연결할 수 있어요.',
    area: '외부 AI 호스트 · 후속 연결 기능', agent: 'MCP 클라이언트 → 어댑터 → 공통 도구',
    example: '외부 AI가 도구 목록을 확인한 뒤 기간 계산과 거래 집계를 요청합니다.',
    steps: ['initialize로 프로토콜 버전과 지원 기능을 협상합니다.', '서버가 인증·권한에 따라 tools/list 목록을 제공합니다.', '클라이언트가 tools/call로 승인된 조회 도구를 요청합니다.', '어댑터가 공통 서버 도구를 호출하고 구조화 결과와 오류를 전달합니다.'],
    tools: ['list_categories', 'resolve_period', 'aggregate_transactions', 'list_statistic_rules'],
    boundary: '초기 MCP는 네 개의 조회 도구만 노출합니다. 거래 초안·메모 근거 검색·결과 참조 비교는 초기 목록에 없습니다.',
    notes: ['MCP는 연결 규약이며 모델 자체가 아닙니다. 외부 AI 호스트의 지원 전송·인증·버전을 확인해야 합니다.', '로컬 합성 자료 실습은 stdio, 후속 원격 연결은 HTTPS Streamable HTTP로 설계합니다. 원격 인가는 OAuth와 사용자 범위를 검증합니다.', '서버에 저장한 기록은 현재 MCP로 읽을 수 없습니다. MCP 서버·인증 서버·외부 서비스 연결은 아직 없습니다.', '외부 호스트가 집계값을 비교한 설명은 서버의 검증된 비교 결과와 구분합니다.'],
    source: 'mcp.md · tools.md',
  },
]

export function AiWikiPage({ section, onSectionChange, onAssistant }: Props) {
  const topic = topics.find((item) => item.id === section)
  const activeId = topic?.id ?? 'overview'
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }) }, [activeId])

  return <section className="wiki-page" aria-labelledby="wiki-title">
    <div className="page-heading">
      <div><div className="eyebrow">AI GUIDE</div><h1 id="wiki-title">AI 위키</h1><p>가계부의 화면과 에이전트 설계를 연결해서 살펴보세요.</p></div>
      <span className="wiki-design-badge"><BookOpen size={14} aria-hidden="true" /> 설계 가이드</span>
    </div>
    <div className="wiki-layout">
      <nav className="wiki-nav" aria-label="AI 위키 목차">
        <span className="wiki-nav-label">이 가이드에서</span>
        <button type="button" aria-current={activeId === 'overview' ? 'page' : undefined} onClick={() => onSectionChange('overview')}>한눈에 보기</button>
        {topics.map((item, index) => <button type="button" key={item.id} aria-current={activeId === item.id ? 'page' : undefined} onClick={() => onSectionChange(item.id)}><span>{String(index + 1).padStart(2, '0')}</span>{item.title}</button>)}
        <div className="wiki-nav-note"><Layers3 size={19} aria-hidden="true" /><p>추천과 설명은 에이전트가,<br />권한과 계산은 서버가 맡아요.</p></div>
      </nav>
      <article className="wiki-article" aria-labelledby="wiki-article-title">
        <div className="wiki-status"><CheckCircle2 size={18} aria-hidden="true" /><div><strong>거래 채우기와 RAG 추천은 구현되어 있어요</strong><p>거래 폼은 거래 추출 AI와 PostgreSQL·pgvector 기반 추천을 사용합니다. API·DB·서버용 키가 필요합니다. 채팅 통계는 각본형 체험이며 별도 에이전트·공통 도구·인증·MCP는 후속 설계입니다.</p></div></div>
        {!topic ? <>
          <header className="wiki-article-heading"><span className="wiki-kicker">OVERVIEW</span><h2 id="wiki-article-title" ref={headingRef} tabIndex={-1}>어디에, 어떤 AI가 쓰일까요?</h2><p>화면에서 시작한 요청이 어떤 에이전트와 도구를 거치는지 정리했습니다.</p></header>
          <div className="wiki-table-scroll" role="region" aria-label="화면별 AI 설계 비교" tabIndex={0}><table className="wiki-table"><caption>화면 영역과 현재 구현·후속 설계</caption><thead><tr><th scope="col">화면 영역</th><th scope="col">계획된 흐름</th><th scope="col">현재 상태</th></tr></thead><tbody>
            <tr><th scope="row">거래 폼 · 채우기·카테고리</th><td><button type="button" onClick={() => onSectionChange('category-rag')}>RAG 검색 → 추천 → 초안 확인</button></td><td>거래 추출 → pgvector 검색 → AI 추천 구현</td></tr>
            <tr><th scope="row">입력 도우미 · 통계 질문</th><td><button type="button" onClick={() => onSectionChange('chat-statistics')}>의도 해석 → 기간 확정 → 집계</button></td><td>월별 합계 각본형 응답</td></tr>
            <tr><th scope="row">대시보드 · 규칙 통계 안내</th><td><button type="button" onClick={() => onSectionChange('rule-statistics')}>규칙 선택 → 검증 → 평가</button></td><td>설계 단계</td></tr>
            <tr><th scope="row">대시보드 · 주간 비교 안내</th><td><button type="button" onClick={() => onSectionChange('plan-and-execute')}>계획 → 검증 → 실행 → 설명</button></td><td>설계 단계</td></tr>
            <tr><th scope="row">외부 AI 연결</th><td><button type="button" onClick={() => onSectionChange('mcp')}>MCP → 권한 확인 → 공통 도구</button></td><td>설계 단계</td></tr>
          </tbody></table></div>
          <section className="wiki-block"><h3>향후 에이전트 요청이 지나가는 길</h3><ol className="wiki-pipeline"><li><strong>화면</strong><span>질문 입력·결과 확인</span></li><li><strong>서버</strong><span>사용자·도구 권한 검증</span></li><li><strong>에이전트</strong><span>의도 해석·계획·설명</span></li><li><strong>공통 도구</strong><span>검색·집계·비교</span></li></ol><p>에이전트는 도구 결과로 답을 만들고 서버는 응답의 숫자와 근거를 검증합니다. 사용자는 거래 확정과 규칙 활성화를 직접 결정합니다.</p></section>
          <div className="wiki-boundary"><strong>설계와 현재 체험을 구분해요</strong><p>대시보드와 거래 목록은 브라우저 저장 기록을 표시합니다. 이 위키를 여는 것만으로 기록을 모델이나 외부 AI에 전송하지 않습니다.</p></div>
          <section className="wiki-demo"><div><h3>현재 동작을 직접 살펴보세요</h3><p>입력 도우미의 “채팅으로 거래 채우기”에서 실제 AI 폼을 열 수 있어요. 아래 대화창은 각본형 체험입니다.</p></div><Button onClick={onAssistant}>입력 도우미 체험 <ArrowRight size={15} aria-hidden="true" /></Button></section>
          <footer className="wiki-source">설계 출처: docs/ai/README.md · agent-architecture.md 및 목차의 세부 문서</footer>
        </> : <>
          <header className="wiki-article-heading"><span className="wiki-kicker">{topic.id === 'category-rag' ? 'IMPLEMENTED' : 'DESIGN'} · {topics.indexOf(topic) + 1} / 6</span><h2 id="wiki-article-title" ref={headingRef} tabIndex={-1}>{topic.title}</h2><p>{topic.subtitle}</p></header>
          <dl className="wiki-context"><div><dt>사용할 화면</dt><dd>{topic.area}</dd></div><div><dt>에이전트 흐름</dt><dd>{topic.agent}</dd></div></dl>
          <blockquote className="wiki-example"><span>사용 예시</span><p>{topic.example}</p></blockquote>
          <section className="wiki-block"><h3>처리 파이프라인</h3><ol className="wiki-steps">{topic.steps.map((step, index) => <li key={step}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>)}</ol></section>
          <section className="wiki-block"><h3>후속 공통 도구 계약</h3><ul className="wiki-tools">{topic.tools.map((tool) => <li key={tool}><code>{tool}</code></li>)}</ul><p>도구 이름은 docs/ai에 정의된 후속 서버 계약입니다. 현재 거래 폼은 전용 API로 동작하며 이 공통 도구나 별도 에이전트 서비스는 아직 실행하지 않습니다.</p></section>
          <div className="wiki-boundary"><strong>권한과 확인의 경계</strong><p>{topic.boundary}</p></div>
          <section className="wiki-block"><h3>알아두면 좋은 설계 원칙</h3><ul className="wiki-notes">{topic.notes.map((note) => <li key={note}>{note}</li>)}</ul></section>
          <footer className="wiki-source">설계 출처: docs/ai/{topic.source}</footer>
        </>}
      </article>
    </div>
  </section>
}
