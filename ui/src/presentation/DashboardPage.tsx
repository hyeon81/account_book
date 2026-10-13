import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, CirclePlus, Plus, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { filterTransactions, summarize } from '@/application/ledger'
import { categoryFor, dateLabel, monthLabel, shiftMonth, won } from '@/domain/transaction'
import type { Transaction } from '@/domain/transaction'
import { CategoryIcon } from './CategoryIcon'

type Props = {
  month: string
  onMonthChange: (month: string) => void
  transactions: Transaction[]
  onAdd: () => void
  onTransactions: () => void
}

export function DashboardPage({ month, onMonthChange, transactions, onAdd, onTransactions }: Props) {
  const summary = summarize(transactions, month)
  const biggest = summary.expensesByCategory[0]?.amount ?? 0
  const recent = filterTransactions(transactions, { month, type: 'all', categoryId: 'all' }).slice(0, 5)

  return (
    <section aria-labelledby="dashboard-title">
      <div className="page-heading">
        <div><h1 id="dashboard-title">대시보드</h1><p>이번 달 수입과 지출을 한눈에.</p></div>
        <div className="dashboard-actions"><Button className="dashboard-add" onClick={onAdd}><Plus size={16} /> 거래 추가</Button><div className="month-switcher" aria-label="조회 월 선택">
          <Button variant="ghost" size="icon-sm" aria-label="이전 달" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft size={17} /></Button>
          <strong>{monthLabel(month)}</strong>
          <Button variant="ghost" size="icon-sm" aria-label="다음 달" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight size={17} /></Button>
        </div></div>
      </div>

      <>
          <div className="summary-grid">
            <Card className="metric-card"><CardContent className="metric-content"><div className="metric-header"><span>총 수입</span><span className="metric-icon income"><ArrowDownRight size={18} /></span></div>
              <strong>{won(summary.incomeTotal)}</strong><small>이번 달 들어온 금액</small></CardContent></Card>
            <Card className="metric-card"><CardContent className="metric-content"><div className="metric-header"><span>총 지출</span><span className="metric-icon expense"><ArrowUpRight size={18} /></span></div>
              <strong>{won(summary.expenseTotal)}</strong><small>이번 달 사용한 금액</small></CardContent></Card>
            <Card className="metric-card difference"><CardContent className="metric-content"><div className="metric-header"><span>수입 − 지출</span><span className="metric-icon balance"><ArrowRight size={18} /></span></div>
              <strong>{won(summary.difference)}</strong><small>계좌 잔액과는 다른 금액이에요</small></CardContent></Card>
          </div>

          <div className="dashboard-grid">
            <Card className="surface-card recent-card" role="region" aria-labelledby="recent-title">
              <CardHeader className="card-heading"><div><h2 id="recent-title">최근 거래</h2><p className="card-description">선택한 달의 최근 기록 {recent.length}건</p></div>
                <Button variant="ghost" size="sm" onClick={onTransactions}>전체 보기 <ArrowRight size={15} /></Button></CardHeader>
              {recent.length ? <div className="recent-list">{recent.map((item) => <div className="recent-row" key={item.id}>
                <CategoryIcon categoryId={item.categoryId} />
                <div className="recent-description"><strong>{item.merchant || categoryFor(item.categoryId)?.name || '거래'}</strong><small>{categoryFor(item.categoryId)?.name} · {dateLabel(item.date)}</small></div>
                <strong className={`recent-amount ${item.type}`}>{item.type === 'income' ? '+' : '−'}{won(item.amount)}</strong>
              </div>)}</div> : <div className="empty-inline"><ReceiptText size={28} /><p>아직 기록된 거래가 없어요.</p><Button variant="outline" onClick={onAdd}><CirclePlus size={16} /> 첫 거래 기록하기</Button></div>}
            </Card>
            <Card className="surface-card categories-card" role="region" aria-labelledby="category-title">
              <CardHeader className="card-heading"><div><h2 id="category-title">지출 비중</h2><p className="card-description">카테고리별 사용 금액</p></div></CardHeader>
              {summary.expensesByCategory.length ? <div className="category-list">
                {summary.expensesByCategory.map(({ category, amount }) => (
                  <div className="category-line" key={category.id}>
                    <CategoryIcon categoryId={category.id} />
                    <div className="category-information"><div><strong>{category.name}</strong><span>{won(amount)}</span></div>
                      <Progress className="progress-track" value={Math.round(amount / biggest * 100)} /></div>
                    <small>{Math.round(amount / summary.expenseTotal * 100)}%</small>
                  </div>
                ))}
              </div> : <div className="empty-inline"><p>이 달에 기록된 거래가 없습니다.</p><Button variant="outline" onClick={onAdd}><CirclePlus size={16} /> 거래 추가</Button></div>}
            </Card>
          </div>
        </>
    </section>
  )
}
