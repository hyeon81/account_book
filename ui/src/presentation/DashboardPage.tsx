import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, CirclePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { summarize } from '@/application/ledger'
import { monthLabel, shiftMonth, won } from '@/domain/transaction'
import type { Transaction } from '@/domain/transaction'

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

  return (
    <section aria-labelledby="dashboard-title">
      <div className="page-heading">
        <div><div className="eyebrow">OVERVIEW</div><h1 id="dashboard-title">대시보드</h1><p>이번 달의 돈 흐름을 한눈에 살펴보세요.</p></div>
        <div className="month-switcher" aria-label="조회 월 선택">
          <Button variant="ghost" size="icon-sm" aria-label="이전 달" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft size={17} /></Button>
          <strong>{monthLabel(month)}</strong>
          <Button variant="ghost" size="icon-sm" aria-label="다음 달" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight size={17} /></Button>
        </div>
      </div>

      <>
          <div className="summary-grid">
            <Card className="metric-card"><CardContent className="metric-content"><div className="metric-header"><span>총 수입</span><span className="metric-icon income"><ArrowDownRight size={18} /></span></div>
              <strong>{won(summary.incomeTotal)}</strong><small>이번 달 들어온 금액</small></CardContent></Card>
            <Card className="metric-card"><CardContent className="metric-content"><div className="metric-header"><span>총 지출</span><span className="metric-icon expense"><ArrowUpRight size={18} /></span></div>
              <strong>{won(summary.expenseTotal)}</strong><small>이번 달 사용한 금액</small></CardContent></Card>
            <Card className="metric-card difference"><CardContent className="metric-content"><div className="metric-header"><span>수입 − 지출</span><span className="metric-icon balance">↗</span></div>
              <strong>{won(summary.difference)}</strong><small>계좌 잔액과는 다른 금액이에요</small></CardContent></Card>
          </div>

          <div className="dashboard-grid">
            <Card className="surface-card categories-card" role="region" aria-labelledby="category-title">
              <CardHeader className="card-heading"><div><div className="eyebrow">SPENDING BREAKDOWN</div><h2 id="category-title">카테고리별 지출</h2></div><span className="subtle-meta">{monthLabel(month)}</span></CardHeader>
              {summary.expensesByCategory.length ? <div className="category-list">
                {summary.expensesByCategory.map(({ category, amount }) => (
                  <div className="category-line" key={category.id}>
                    <span className="category-symbol" style={{ background: `${category.color}20`, color: category.color }}>{category.icon}</span>
                    <div className="category-information"><div><strong>{category.name}</strong><span>{won(amount)}</span></div>
                      <Progress className="progress-track" value={Math.round(amount / biggest * 100)} indicatorStyle={{ background: category.color }} /></div>
                    <small>{Math.round(amount / summary.expenseTotal * 100)}%</small>
                  </div>
                ))}
              </div> : <div className="empty-inline"><p>이 달에 기록된 거래가 없습니다.</p><Button variant="outline" onClick={onAdd}><CirclePlus size={16} /> 거래 추가</Button></div>}
            </Card>
            <Card className="surface-card insight-card"><div className="insight-art"><div className="insight-orb one" /><div className="insight-orb two" /><span>✦</span></div>
              <div className="eyebrow">A LITTLE INSIGHT</div><h2>작은 기록이<br />큰 차이를 만들어요.</h2>
              <p>오늘의 지출을 남기고 나만의 소비 흐름을 알아보세요.</p>
              <Button onClick={onAdd}>새 거래 기록하기 <ArrowRight size={16} /></Button>
            </Card>
          </div>
          <div className="dashboard-footer"><span>최근 기록을 자세히 살펴보고 싶나요?</span><Button variant="ghost" onClick={onTransactions}>거래 내역 보기 <ArrowRight size={16} /></Button></div>
        </>
    </section>
  )
}
