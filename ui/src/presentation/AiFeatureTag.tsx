import { Sparkles } from 'lucide-react'

type Props = { feature: string; preview?: boolean; newTab?: boolean }

const names: Record<string, string> = { overview: '입력 도우미', 'category-rag': '카테고리 추천', 'chat-statistics': '채팅 통계', 'rule-statistics': '규칙 통계', 'plan-and-execute': '주간 비교' }

export function AiFeatureTag({ feature, preview = false, newTab = false }: Props) {
  const label = feature === 'category-rag' ? 'AI 기능 안내' : preview ? 'AI 미리보기' : 'AI 설계'
  return <a className="ai-feature-tag" href={`#ai-wiki/${feature}`} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}
    aria-label={`${names[feature] ?? 'AI 기능'} ${label} 설명 보기${newTab ? ' (새 탭)' : ''}`}>
    <Sparkles size={12} aria-hidden="true" />{label}
  </a>
}
