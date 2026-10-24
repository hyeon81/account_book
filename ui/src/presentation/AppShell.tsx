import { useEffect, useState } from 'react'
import { ArrowDownUp, BookOpen, ChartNoAxesCombined, LayoutDashboard, Plus, Sparkles, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { monthOf, seoulToday } from '@/domain/transaction'
import type { Transaction, TransactionInput } from '@/domain/transaction'
import { localLedger } from '@/infrastructure/localLedger'
import { useServerLedger } from './useServerLedger'
import { DashboardPage } from './DashboardPage'
import { TransactionsPage } from './TransactionsPage'
import { AssistantPage } from './AssistantPage'
import { TransactionForm } from './TransactionForm'
import { ReportsPage } from './ReportsPage'
import { AiWikiPage } from './AiWikiPage'
import { pageFromHash, wikiSectionFromHash } from '@/application/wikiNavigation'

type Page = 'dashboard' | 'transactions' | 'assistant' | 'reports' | 'wiki'
type FormState = { mode: 'create' | 'edit' | 'draft'; initial?: TransactionInput; id?: string; afterSave?: () => void; cardMessage?: boolean }

const navigation = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'transactions', label: '거래 내역', icon: ArrowDownUp },
  { id: 'reports', label: '리포트', icon: ChartNoAxesCombined },
  { id: 'assistant', label: '입력 도우미', icon: Sparkles },
  { id: 'wiki', label: 'AI 위키', icon: BookOpen },
] as const

export function AppShell() {
  const [page, setCurrentPage] = useState<Page>(() => pageFromHash(window.location.hash))
  const [wikiSection, setWikiSection] = useState(() => wikiSectionFromHash(window.location.hash) ?? 'overview')
  const setPage = (next: Page) => {
    window.location.hash = next === 'wiki' ? `ai-wiki/${wikiSection}` : next
    setCurrentPage(next)
  }
  const openWikiSection = (section: string) => {
    window.location.hash = `ai-wiki/${section}`
    setWikiSection(section)
  }
  const [month, setMonth] = useState(() => monthOf(seoulToday()))
  const ledger = useServerLedger()
  const [importError, setImportError] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const navigate = () => {
      setCurrentPage(pageFromHash(window.location.hash))
      setWikiSection(wikiSectionFromHash(window.location.hash) ?? 'overview')
      setForm(null)
    }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])

  const save = async (input: TransactionInput) => {
    if (form?.mode === 'edit' && form.id) await ledger.update(form.id, input)
    else await ledger.add(input)
    form?.afterSave?.()
    setForm(null)
    setNotice(form?.mode === 'edit' ? '거래를 수정했어요.' : '거래를 저장했어요.')
  }
  const importExisting = async () => {
    setImportError('')
    try {
      const original = localLedger.load()
      if (!original.length) { setNotice('이 브라우저에 가져올 기존 거래가 없어요.'); return }
      const result = await ledger.importItems(original)
      setNotice(`${result.imported}건을 가져왔어요. 이미 가져온 ${result.skipped}건은 건너뛰었어요. 브라우저 원본은 백업으로 유지해요.`)
      await ledger.reload()
    } catch (cause) {
      setImportError(`${cause instanceof Error ? cause.message : '가져오지 못했어요.'} 일부 거래가 이미 저장됐을 수 있어요. 다시 가져와도 중복 저장되지 않아요. 브라우저 원본은 유지돼요.`)
      await ledger.reload()
    }
  }
  const edit = (transaction: Transaction) => {
    if (ledger.busy) return
    setForm({ mode: 'edit', initial: transaction, id: transaction.id })
  }
  const confirmDraft = async (draft: TransactionInput) => {
    await ledger.add(draft)
    setNotice('초안이 거래로 저장됐어요.')
  }
  const remove = (id: string) => ledger.remove(id)

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="주 탐색">
        <Button variant="ghost" className="brand" onClick={() => setPage('dashboard')} aria-label="모아 대시보드로 이동">
          <span className="brand-mark"><Wallet size={21} strokeWidth={2.2} /></span>
          <span><strong>모아</strong><small>나의 가계부</small></span>
        </Button>
        <div className="sidebar-section-label">내 가계부</div>
        <nav className="sidebar-nav" aria-label="페이지">
          {navigation.map(({ id, label, icon: Icon }) => (
            <Button key={id} variant="ghost" className={`nav-item ${page === id ? 'active' : ''}`}
              aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>
              <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
            </Button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-profile"><span className="avatar">나</span><span><strong>개인 가계부</strong><small>개인 서버에 저장</small></span></div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb"><span>내 공간</span><span className="crumb-separator">/</span><strong>{navigation.find((item) => item.id === page)?.label}</strong></div>
          <div className="top-actions"><Button variant="outline" size="sm" className="wiki-trigger" aria-current={page === 'wiki' ? 'page' : undefined} onClick={() => setPage('wiki')}><BookOpen size={15} /> AI 위키</Button><span className="mock-pill"><span /> 서버에 저장</span>
            <Button className="top-add" disabled={!ledger.ready || ledger.busy} onClick={() => setForm({ mode: 'create' })}><Plus size={16} /> 거래 추가</Button>
          </div>
        </header>
        <main className="page-content" id="main-content">
          {notice && <div className="notice" role="status">{notice}<Button variant="ghost" size="icon-sm" onClick={() => setNotice('')} aria-label="알림 닫기">×</Button></div>}
          <div className="notice"><span>이 서버의 거래를 함께 사용해요. 기존 브라우저 기록은 직접 가져올 수 있어요.</span><Button variant="outline" size="sm" disabled={!ledger.ready || ledger.busy} onClick={() => void importExisting()}>기존 거래 가져오기</Button><Button variant="ghost" size="sm" disabled={ledger.loading || ledger.busy} onClick={() => void ledger.reload()}>새로고침</Button></div>
          {importError && <div className="notice" role="alert">{importError}</div>}
          {ledger.loading && <div className="notice" role="status">거래를 불러오고 있어요…</div>}
          {ledger.error && <div className="notice" role="alert">{ledger.error} <Button variant="ghost" size="sm" onClick={() => void ledger.reload()}>다시 불러오기</Button></div>}
          {ledger.ready && <>
          <div hidden={page !== 'dashboard'}><DashboardPage month={month} onMonthChange={setMonth} transactions={ledger.items}
            onAdd={() => { if (!ledger.busy) setForm({ mode: 'create' }) }} onTransactions={() => setPage('transactions')} /></div>
          <div hidden={page !== 'transactions'}><TransactionsPage month={month} onMonthChange={setMonth} transactions={ledger.items}
            onAdd={() => { if (!ledger.busy) setForm({ mode: 'create' }) }} onEdit={edit} onDelete={remove} /></div>
          <div hidden={page !== 'reports'}><ReportsPage month={month} onMonthChange={setMonth} transactions={ledger.items} /></div>
          <div hidden={page !== 'assistant'}><AssistantPage month={month} transactions={ledger.items}
            onConfirmDraft={confirmDraft} onEditDraft={(draft, afterSave) => { if (!ledger.busy) setForm({ mode: 'draft', initial: draft, afterSave }) }}
            onCardMessage={() => { if (!ledger.busy) setForm({ mode: 'create', cardMessage: true }) }}
            onTransactions={() => setPage('transactions')} /></div>
          </>}
          <div hidden={page !== 'wiki'}>{page === 'wiki' && <AiWikiPage section={wikiSection} onSectionChange={openWikiSection} onAssistant={() => setPage('assistant')} />}</div>
        </main>
      </div>
      <TransactionForm key={`${form?.mode}-${form?.id ?? 'new'}-${form ? 'open' : 'closed'}`}
        open={form !== null} mode={form?.mode ?? 'create'} initial={form?.initial} cardMessage={form?.cardMessage}
        onOpenChange={(open) => { if (!open) setForm(null) }} onSave={save} />
    </div>
  )
}
