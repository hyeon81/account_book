import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RecommendationResult } from '@/application/categoryRecommendation'
import { categoryFor } from '@/domain/transaction'

type Props = {
  busy: boolean
  enabled: boolean
  result: RecommendationResult | null
  notice: string
  onRecommend: () => Promise<void>
}

export function CategoryRecommendation({ busy, enabled, result, notice, onRecommend }: Props) {
  return <div className="space-y-2">
    <Button type="button" variant="outline" size="sm" disabled={busy || !enabled} onClick={() => void onRecommend()} aria-describedby="category-ai-notice">
      <Sparkles size={15} />{busy ? 'AI가 근거를 확인하고 있어요…' : 'AI로 카테고리 추천'}
    </Button>
    <p className="text-sm text-muted-foreground">AI 추천 시 사용처·메모와 저장된 분류 내역을 전송해요.</p>
    {!enabled && <p className="text-sm text-muted-foreground">사용처 또는 메모를 입력하면 추천받을 수 있어요.</p>}
    <div id="category-ai-notice" role="status" aria-live="polite" className="space-y-2 text-sm">
      {notice && <p>{notice}</p>}
      {result && <>
        <p>{result.status === 'recommended' ? `${categoryFor(result.category_id ?? '')?.name} 추천 · ` : ''}{result.reason}</p>
        {result.status === 'recommended' && <p className="text-muted-foreground">추천을 확인하고 수정할 수 있어요. 저장 버튼을 누르면 기록돼요.</p>}
        {result.evidence.length > 0 && <details className="rounded-md border p-2">
          <summary className="cursor-pointer">참고한 분류 근거 {result.evidence.length}개</summary>
          <ul className="mt-2 space-y-2">{result.evidence.map((item) => <li key={item.id}>
            <strong>{categoryFor(item.category_id)?.name} · {item.source === 'transaction' ? '저장된 거래' : '카테고리 설명'}</strong>
            <p className="whitespace-pre-wrap break-words text-muted-foreground">{item.text}</p>
          </li>)}</ul>
        </details>}
      </>}
    </div>
  </div>
}
