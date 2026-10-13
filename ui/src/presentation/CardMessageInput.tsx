import { useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { categoryFor, monthOf, seoulToday } from '@/domain/transaction'
import type { TransactionInput } from '@/domain/transaction'
import { scriptedAssistant } from '@/infrastructure/scriptedAssistant'

type Props = {
  initiallyOpen: boolean
  onDraft: (draft: TransactionInput) => void
  onBlockedChange: (blocked: boolean) => void
}
type ChatLine = { role: 'user' | 'assistant'; text: string }

export function CardMessageInput({ initiallyOpen, onDraft, onBlockedChange }: Props) {
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<ChatLine[]>([])
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [invalid, setInvalid] = useState(false)
  const today = seoulToday()
  const cardExample = `[Web발신]\n모아카드 승인\n5,500원 일시불\n${today.replaceAll('-', '/')} 14:30\n달빛커피\n누적 125,500원`
  const change = (value: string) => {
    setMessage(value)
    onBlockedChange(Boolean(value.trim()) || loading)
  }
  const send = async () => {
    const text = message.trim()
    if (!text || loading) return
    setMessage(''); setLoading(true); setInvalid(false); onBlockedChange(true)
    setHistory((lines) => [...lines, { role: 'user', text }])
    try {
      const fullMessage = context ? `${context} ${text}` : text
      const result = await scriptedAssistant.ask(fullMessage, monthOf(today), [])
      if (result.kind === 'transaction_draft') {
        onDraft(result.draft)
        const category = categoryFor(result.draft.categoryId)
        const reply = `아래 입력 항목을 채웠어요. ${category ? `${category.name} 추천을 확인하고 수정할 수 있어요.` : '카테고리를 직접 선택해 주세요.'} 저장 버튼을 누르기 전에는 기록되지 않아요.`
        setHistory((lines) => [...lines, { role: 'assistant', text: reply }])
        setNotice(reply); setContext(''); onBlockedChange(false)
      } else {
        setHistory((lines) => [...lines, { role: 'assistant', text: result.reply }])
        setNotice(result.reply); setInvalid(true)
        setContext(result.kind === 'clarification' && result.continueContext !== false ? fullMessage : '')
      }
    } catch (cause) {
      const reply = cause instanceof Error ? cause.message : '문장을 읽지 못했어요. 다시 보내 주세요.'
      setHistory((lines) => [...lines, { role: 'assistant', text: reply }])
      setNotice(reply); setInvalid(true); setMessage(text)
    } finally { setLoading(false) }
  }

  return <details className="card-message-input" open={initiallyOpen}>
    <summary><MessageSquare size={16} /> 채팅으로 거래 채우기 <span>목 체험</span></summary>
    <div className="card-message-body">
      <p>카드 문자 또는 지출 문장을 보내면 아래 거래 항목을 채워요. 실제 AI 연결 없이 규칙으로 처리합니다.</p>
      <div className="form-input-chat" role="log" aria-label="거래 입력 대화" aria-live="polite">
        {history.length ? history.map((line, index) => <div key={index} className={`form-chat-line ${line.role}`}><strong>{line.role === 'user' ? '나' : '모아'}</strong><span>{line.text}</span></div>)
          : <div className="form-chat-line assistant"><strong>모아</strong><span>“오늘 오후 3시에 카페에서 5천원 썼어”처럼 알려주세요. 카드 문자도 같은 채팅에 붙여넣을 수 있어요.</span></div>}
        {loading && <div className="form-chat-line assistant"><strong>모아</strong><span>초안을 만들고 있어요…</span></div>}
      </div>
      <Label htmlFor="card-message">카드 문자 또는 거래 문장</Label>
      <Textarea id="card-message" rows={3} value={message} placeholder="오늘 오후 3시에 카페에서 5천원 썼어" disabled={loading}
        onChange={(event) => change(event.target.value)} aria-invalid={invalid} aria-describedby="card-message-notice"
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } }} />
      <div className="card-message-tools">
        <Button type="button" size="sm" disabled={loading || !message.trim()} onClick={() => void send()}><Send size={14} /> 문장 보내기</Button>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => change('오늘 오후 3시에 카페에서 5천원 썼어')}>문장 예시</Button>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => change(cardExample)}>카드 문자 예시</Button>
        <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => { change(''); setContext(''); setInvalid(false); setNotice('채팅 내용을 지웠어요. 아래 항목을 직접 수정할 수 있어요.'); setHistory([]) }}>직접 입력으로 계속</Button>
      </div>
      <small id="card-message-notice" className={invalid ? 'field-error' : 'card-message-notice'} role="status">{notice || 'Enter로 보내기 · Shift+Enter로 줄바꿈. 내용은 외부 서버로 보내지 않습니다.'}</small>
    </div>
  </details>
}
