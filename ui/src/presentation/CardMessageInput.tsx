import { useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { categoryFor, seoulToday } from '@/domain/transaction'
import type { TransactionInput } from '@/domain/transaction'
import { parseCardMessage } from '@/infrastructure/cardMessage'

type Props = {
  initiallyOpen: boolean
  onDraft: (draft: TransactionInput) => void
  onBlockedChange: (blocked: boolean) => void
}

export function CardMessageInput({ initiallyOpen, onDraft, onBlockedChange }: Props) {
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [invalid, setInvalid] = useState(false)
  const today = seoulToday()
  const example = `[Web발신]\n모아카드 승인\n5,500원 일시불\n${today.replaceAll('-', '/')} 14:30\n달빛커피\n누적 125,500원`
  const change = (value: string) => {
    setMessage(value)
    if (!value.trim()) {
      setNotice(''); setInvalid(false); onBlockedChange(false)
      return
    }
    const result = parseCardMessage(value, today)
    const blocked = result.kind !== 'draft'
    setInvalid(blocked)
    onBlockedChange(blocked)
    if (result.kind === 'draft') {
      onDraft(result.draft)
      const category = categoryFor(result.draft.categoryId)
      setNotice(category ? `내용을 채웠어요. ${category.name} 추천: ${result.categoryReason} 직접 바꿀 수 있어요.` : '내용을 채웠어요. 분류가 어려워 카테고리를 직접 선택해 주세요.')
    } else setNotice(result.reason)
  }

  return <details className="card-message-input" open={initiallyOpen}>
    <summary><ClipboardPaste size={16} /> 카드 문자로 자동 입력 <span>체험</span></summary>
    <div className="card-message-body">
      <p>결제 승인 문자 한 건을 붙여넣으면 날짜·금액·사용처와 카테고리를 채워요. 저장 전 내용을 확인해 주세요.</p>
      <Label htmlFor="card-message">카드 승인 문자</Label>
      <Textarea id="card-message" rows={5} value={message} placeholder={example} onChange={(event) => change(event.target.value)} aria-invalid={invalid} aria-describedby="card-message-notice" />
      <div className="card-message-tools"><Button type="button" variant="outline" size="sm" onClick={() => change(example)}>예시 체험</Button>
        {message && <Button type="button" variant="ghost" size="sm" onClick={() => change('')}>직접 입력으로 계속</Button>}</div>
      <small id="card-message-notice" className={invalid ? 'field-error' : 'card-message-notice'} role="status">{notice || '규칙으로 처리하는 목 기능입니다. 실제 AI나 외부 서버로 전송하지 않습니다.'}</small>
    </div>
  </details>
}
