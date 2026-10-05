import { useState } from 'react'
import { ArrowDownUp, LayoutDashboard, Plus, Sparkles, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { monthOf, seoulToday } from '@/domain/transaction'
import type { Transaction, TransactionInput } from '@/domain/transaction'
import { mockLedger } from '@/infrastructure/mockLedger'
import { DashboardPage } from './DashboardPage'
import { TransactionsPage } from './TransactionsPage'
import { AssistantPage } from './AssistantPage'
import { TransactionForm } from './TransactionForm'

type Page = 'dashboard' | 'transactions' | 'assistant'
export type PreviewState = 'normal' | 'loading' | 'error'
type FormState = { mode: 'create' | 'edit' | 'draft'; initial?: TransactionInput; id?: string; afterSave?: () => void }

const navigation = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'transactions', label: '거래 내역', icon: ArrowDownUp },
  { id: 'assistant', label: 'AI 도우미', icon: Sparkles },
] as const

export function AppShell() {
  const [page, setPage] = useState<Page>('dashboard')
  const [month, setMonth] = useState(() => monthOf(seoulToday()))
  const [revision, setRevision] = useState(0)
  const [preview, setPreview] = useState<PreviewState>('normal')
  const [form, setForm] = useState<FormState | null>(null)
  const [notice, setNotice] = useState('')

  const refresh = () => setRevision((value) => value + 1)
  const save = (input: TransactionInput) => {
    if (form?.mode === 'edit' && form.id) mockLedger.update(form.id, input)
    else mockLedger.add(input)
    refresh()
    form?.afterSave?.()
    setForm(null)
    setNotice(form?.mode === 'edit' ? '거래를 수정했어요.' : '거래를 저장했어요. 목 데이터는 새로고침하면 초기화됩니다.')
  }
  const edit = (transaction: Transaction) => {
    const { id, ...initial } = transaction
    setForm({ mode: 'edit', initial, id })
  }
  const confirmDraft = (draft: TransactionInput) => {
    mockLedger.add(draft)
    refresh()
    setNotice('초안이 거래로 저장됐어요. 목 데이터는 새로고침하면 초기화됩니다.')
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="주 탐색">
        <button className="brand" onClick={() => setPage('dashboard')} aria-label="모아 대시보드로 이동">
          <span className="brand-mark"><Wallet size={21} strokeWidth={2.2} /></span>
          <span><strong>모아</strong><small>나의 가계부</small></span>
        </button>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="페이지">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'active' : ''}`}
              aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>
              <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
              {id === 'assistant' && <span className="nav-new">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="preview-control">
            <label htmlFor="preview-state">목 상태 미리보기</label>
            <Select value={preview} onValueChange={(value) => setPreview(value as PreviewState)}>
              <SelectTrigger id="preview-state" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">일반 화면</SelectItem>
                <SelectItem value="loading">로딩 화면</SelectItem>
                <SelectItem value="error">오류 화면</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sidebar-tip"><Sparkles size={17} /><span>기록이 쌓이면<br />패턴이 보여요.</span></div>
          <div className="sidebar-profile"><span className="avatar">나</span><span><strong>나의 가계부</strong><small>로컬 · 목 데이터</small></span><span className="profile-dot" /></div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb"><span>내 공간</span><span className="crumb-separator">/</span><strong>{navigation.find((item) => item.id === page)?.label}</strong></div>
          <div className="top-actions"><span className="mock-pill"><span /> 목 데이터 사용 중</span>
            <Button className="top-add" onClick={() => setForm({ mode: 'create' })}><Plus size={16} /> 거래 추가</Button>
          </div>
        </header>
        <main className="page-content" id="main-content">
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="알림 닫기">×</button></div>}
          <div hidden={page !== 'dashboard'}><DashboardPage month={month} onMonthChange={setMonth} revision={revision} preview={preview}
            onAdd={() => setForm({ mode: 'create' })} onTransactions={() => setPage('transactions')} /></div>
          <div hidden={page !== 'transactions'}><TransactionsPage month={month} onMonthChange={setMonth} revision={revision} preview={preview}
            onAdd={() => setForm({ mode: 'create' })} onEdit={edit} onChanged={refresh} /></div>
          <div hidden={page !== 'assistant'}><AssistantPage month={month} preview={preview}
            onConfirmDraft={confirmDraft} onEditDraft={(draft, afterSave) => setForm({ mode: 'draft', initial: draft, afterSave })}
            onTransactions={() => setPage('transactions')} /></div>
        </main>
      </div>
      <TransactionForm key={`${form?.mode}-${form?.id ?? 'new'}-${form ? 'open' : 'closed'}`}
        open={form !== null} mode={form?.mode ?? 'create'} initial={form?.initial}
        onOpenChange={(open) => { if (!open) setForm(null) }} onSave={save} />
    </div>
  )
}
