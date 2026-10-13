import { Sparkles } from 'lucide-react'

type Props = { feature: string; preview?: boolean }

const names: Record<string, string> = { overview: '입력 도우미', 'category-rag': '카테고리 추천', 'chat-statistics': '채팅 통계', 'rule-statistics': '규칙 통계', 'plan-and-execute': '주간 비교' }

export function AiFeatureTag({ feature, preview = false }: Props) {
  return <a className="ai-feature-tag" href={`#ai-wiki/${feature}`}
    aria-label={`${names[feature] ?? 'AI 기능'} ${preview ? 'AI 미리보기' : 'AI 설계'} 설명 보기`}>
    <Sparkles size={12} aria-hidden="true" />{preview ? 'AI 미리보기' : 'AI 설계'}
  </a>
}

