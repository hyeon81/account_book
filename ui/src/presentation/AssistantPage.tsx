import { useRef, useState } from 'react'
import { ArrowRight, Check, Send, Sparkles, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { categoryFor, dateLabel, won } from '@/domain/transaction'
import type { TransactionInput } from '@/domain/transaction'
import { mockAssistant } from '@/infrastructure/mockAssistant'
import type { MockReply } from '@/infrastructure/mockAssistant'
import type { PreviewState } from './AppShell'

type Message = { id: number; role: 'user' | 'assistant'; text: string; reply?: MockReply; confirmed?: boolean }
type Props = {
  month: string
  preview: PreviewState
  onConfirmDraft: (draft: TransactionInput) => void
  onEditDraft: (draft: TransactionInput, onSaved: () => void) => void
  onTransactions: () => void
}

const examples = [
  { icon: '✳', title: '거래 등록', prompt: '오늘 점심에 12,000원 썼어' },
  { icon: '◈', title: '지출 확인', prompt: '이번 달 식비 얼마야?' },
  { icon: '↗', title: '다른 달 조회', prompt: '지난달 지출 얼마야?' },
]

export function AssistantPage({ month, preview, onConfirmDraft, onEditDraft, onTransactions }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nextMessageId = useRef(1)

  const markConfirmed = (id: number) => setMessages((current) => current.map((message) => message.id === id ? { ...message, confirmed: true } : message))
  const send = async (override?: string) => {
    const message = (override ?? text).trim()
    if (!message || loading) return
    setError('')
    setText('')
    setLoading(true)
    const userId = nextMessageId.current
    nextMessageId.current += 2
    setMessages((current) => [...current, { id: userId, role: 'user', text: message }])
    try {
      if (preview === 'error') throw new Error('AI 도우미 목 응답을 불러오지 못했어요. 일반 화면으로 바꿔 주세요.')
      const fullMessage = pendingQuestion ? `${pendingQuestion} ${message}` : message
      const reply = await mockAssistant.ask(fullMessage, month)
      setMessages((current) => [...current, { id: userId + 1, role: 'assistant', text: reply.reply, reply }])
      setPendingQuestion(reply.kind === 'clarification' ? fullMessage : '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '응답을 불러오지 못했어요.')
      setText(message)
    } finally { setLoading(false) }
  }
  const confirm = (message: Message, draft: TransactionInput) => {
    try { onConfirmDraft(draft); markConfirmed(message.id); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '초안을 저장하지 못했어요.') }
  }

  return <section className="assistant-page" aria-labelledby="assistant-title">
    <div className="page-heading"><div><div className="eyebrow">YOUR SMART COMPANION</div><h1 id="assistant-title">AI 도우미</h1><p>말로 남기고, 내 소비를 더 쉽게 이해해 보세요.</p></div></div>
    <div className="assistant-layout">
      <div className="surface-card chat-panel">
        <div className="chat-top"><span className="chat-avatar"><Sparkles size={20} /></span><div><strong>모아 도우미</strong><small>목 응답 · 저장 전 확인 필요</small></div><span className="chat-online"><span /> 준비됨</span></div>
        <div className="chat-messages" aria-live="polite">
          {messages.length === 0 && <div className="chat-welcome"><span className="welcome-icon"><WandSparkles size={27} /></span><h2>무엇을 도와드릴까요?</h2><p>거래를 기록하거나 이번 달 지출을 물어보세요.<br />서버 없이 목 데이터로 응답합니다.</p>
            <div className="suggestions">{examples.map((example) => <button key={example.prompt} onClick={() => void send(example.prompt)}><span>{example.icon}</span><small>{example.title}</small><strong>{example.prompt}</strong><ArrowRight size={15} /></button>)}</div>
          </div>}
          {messages.map((message) => { const reply = message.reply; return <div key={message.id} className={`message ${message.role}`}>
            {message.role === 'assistant' && <span className="message-avatar"><Sparkles size={15} /></span>}
            <div className="message-content"><div className="message-bubble">{message.text}</div>
              {reply?.kind === 'answer' && <small className="reply-detail">{reply.detail}</small>}
              {reply?.kind === 'transaction_draft' && <div className="draft-card">
                <div className="draft-heading"><span className={message.confirmed ? 'saved-label' : 'draft-label'}>{message.confirmed ? '저장 완료' : '저장 전 초안'}</span><strong>{categoryFor(reply.draft.categoryId)?.name} {reply.draft.type === 'income' ? '수입' : '지출'}</strong></div>
                <div className="draft-amount">{won(reply.draft.amount)}</div>
                <div className="draft-details"><span>거래일 <strong>{dateLabel(reply.draft.date)}</strong></span><span>유형 <strong>{reply.draft.type === 'income' ? '수입' : '지출'}</strong></span>
                  <span>카테고리 <strong>{categoryFor(reply.draft.categoryId)?.name}</strong></span><span>사용처 <strong>{reply.draft.merchant || '미입력'}</strong></span></div>
                {reply.draft.memo && <p className="draft-memo">메모: {reply.draft.memo}</p>}
                {!message.confirmed && <div className="draft-actions"><Button variant="outline" onClick={() => onEditDraft(reply.draft, () => markConfirmed(message.id))}>수정 후 저장</Button>
                  <Button onClick={() => confirm(message, reply.draft)}><Check size={15} /> 거래 확정</Button></div>}
              </div>}
            </div>
          </div> })}
          {loading && <div className="message assistant"><span className="message-avatar"><Sparkles size={15} /></span><div className="message-bubble" role="status">답변을 준비하고 있어요…</div></div>}
        </div>
        <div className="chat-compose">
          {error && <div className="chat-error" role="alert">{error}<button onClick={onTransactions}>거래 목록 열기</button></div>}
          <form onSubmit={(event) => { event.preventDefault(); void send() }}><label className="sr-only" htmlFor="chat-input">가계부 도우미에게 질문</label>
            <Textarea id="chat-input" placeholder="예: 오늘 점심에 12,000원 썼어" rows={2} value={text} onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} />
            <Button type="submit" disabled={!text.trim() || loading} aria-label="메시지 보내기"><Send size={17} /></Button></form>
          <small>목 데이터 기반 응답이에요. 실제 AI나 서버와 연결되지 않습니다.</small>
        </div>
      </div>
      <aside className="assistant-side"><div className="assistant-side-card"><span className="side-sparkle">✦</span><div className="eyebrow">HOW IT WORKS</div><h2>가볍게 물어보세요</h2><p>자연스러운 문장으로 거래를 기록하거나 내역을 확인할 수 있어요.</p>
        <div className="side-steps"><div><span>01</span><strong>말로 입력</strong><small>평소처럼 문장을 적어요</small></div><div><span>02</span><strong>초안 확인</strong><small>저장 전 내용을 살펴봐요</small></div><div><span>03</span><strong>직접 확정</strong><small>확인한 뒤에만 기록돼요</small></div></div></div>
        <div className="assistant-note"><strong>안심하고 사용하세요</strong><p>이 화면은 목 UI입니다. 모든 거래는 브라우저 메모리에만 있고 새로고침하면 초기화돼요.</p></div></aside>
    </div>
  </section>
}
