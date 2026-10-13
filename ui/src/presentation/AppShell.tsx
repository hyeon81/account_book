import { useEffect, useState } from 'react'
import { ArrowDownUp, ChartNoAxesCombined, LayoutDashboard, Plus, Sparkles, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { monthOf, seoulToday } from '@/domain/transaction'
import type { Transaction, TransactionInput } from '@/domain/transaction'
import { ledgerStorageKey, localLedger } from '@/infrastructure/localLedger'
import { DashboardPage } from './DashboardPage'
import { TransactionsPage } from './TransactionsPage'
import { AssistantPage } from './AssistantPage'
import { TransactionForm } from './TransactionForm'
import { ReportsPage } from './ReportsPage'

type Page = 'dashboard' | 'transactions' | 'assistant' | 'reports'
type FormState = { mode: 'create' | 'edit' | 'draft'; initial?: TransactionInput; id?: string; afterSave?: () => void; cardMessage?: boolean }

function initialLedger(): { items: Transaction[]; error: string } {
  try { return { items: localLedger.load(), error: '' } }
  catch (cause) { return { items: [], error: cause instanceof Error ? cause.message : '거래를 불러오지 못했습니다.' } }
}

const navigation = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'transactions', label: '거래 내역', icon: ArrowDownUp },
  { id: 'reports', label: '리포트', icon: ChartNoAxesCombined },
  { id: 'assistant', label: '입력 도우미', icon: Sparkles },
] as const

export function AppShell() {
  const [page, setPage] = useState<Page>('dashboard')
  const [month, setMonth] = useState(() => monthOf(seoulToday()))
  const [ledger, setLedger] = useState(initialLedger)
  const [form, setForm] = useState<FormState | null>(null)
  const [notice, setNotice] = useState('')

  const reload = () => setLedger(initialLedger())
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === ledgerStorageKey) reload() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const save = (input: TransactionInput) => {
    const items = form?.mode === 'edit' && form.id ? localLedger.update(form.id, input) : localLedger.add(input)
    setLedger({ items, error: '' })
    form?.afterSave?.()
    setForm(null)
    setNotice(form?.mode === 'edit' ? '거래를 수정했어요.' : '거래를 저장했어요.')
  }
  const edit = (transaction: Transaction) => {
    const { id, ...initial } = transaction
    setForm({ mode: 'edit', initial, id })
  }
  const confirmDraft = (draft: TransactionInput) => {
    setLedger({ items: localLedger.add(draft), error: '' })
    setNotice('초안이 거래로 저장됐어요.')
  }
  const remove = (id: string) => setLedger({ items: localLedger.remove(id), error: '' })

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
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><Sparkles size={17} /><span>기록이 쌓이면<br />패턴이 보여요.</span></div>
          <div className="sidebar-profile"><span className="avatar">나</span><span><strong>나의 가계부</strong><small>이 브라우저에 저장</small></span><span className="profile-dot" /></div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb"><span>내 공간</span><span className="crumb-separator">/</span><strong>{navigation.find((item) => item.id === page)?.label}</strong></div>
          <div className="top-actions"><span className="mock-pill"><span /> 브라우저에 저장 중</span>
            <Button className="top-add" onClick={() => setForm({ mode: 'create' })}><Plus size={16} /> 거래 추가</Button>
          </div>
        </header>
        <main className="page-content" id="main-content">
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="알림 닫기">×</button></div>}
          {ledger.error && <div className="notice" role="alert">{ledger.error} <button onClick={reload}>다시 불러오기</button></div>}
          <div hidden={page !== 'dashboard'}><DashboardPage month={month} onMonthChange={setMonth} transactions={ledger.items}
            onAdd={() => setForm({ mode: 'create' })} onTransactions={() => setPage('transactions')} /></div>
          <div hidden={page !== 'transactions'}><TransactionsPage month={month} onMonthChange={setMonth} transactions={ledger.items}
            onAdd={() => setForm({ mode: 'create' })} onEdit={edit} onDelete={remove} /></div>
          <div hidden={page !== 'reports'}><ReportsPage month={month} onMonthChange={setMonth} transactions={ledger.items} /></div>
          <div hidden={page !== 'assistant'}><AssistantPage month={month} transactions={ledger.items}
            onConfirmDraft={confirmDraft} onEditDraft={(draft, afterSave) => setForm({ mode: 'draft', initial: draft, afterSave })}
            onCardMessage={() => setForm({ mode: 'create', cardMessage: true })}
            onTransactions={() => setPage('transactions')} /></div>
        </main>
      </div>
      <TransactionForm key={`${form?.mode}-${form?.id ?? 'new'}-${form ? 'open' : 'closed'}`}
        open={form !== null} mode={form?.mode ?? 'create'} initial={form?.initial} cardMessage={form?.cardMessage}
        onOpenChange={(open) => { if (!open) setForm(null) }} onSave={save} />
    </div>
  )
}
