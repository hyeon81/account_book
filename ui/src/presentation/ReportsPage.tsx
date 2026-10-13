import { useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, CircleDollarSign, PieChart, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildReport, sampleReportTransactions } from '@/application/report'
import { monthLabel, shiftMonth, won } from '@/domain/transaction'
import type { Transaction } from '@/domain/transaction'

type Props = {
  month: string
  onMonthChange: (month: string) => void
  transactions: Transaction[]
}

export function ReportsPage({ month, onMonthChange, transactions }: Props) {
  const [showSample, setShowSample] = useState(false)
  const usingSample = showSample
  const report = buildReport(usingSample ? sampleReportTransactions(month) : transactions, month)
  const biggestCategory = report.summary.expensesByCategory[0]
  const biggestWeekly = Math.max(...report.weeklyExpenses.map((bucket) => bucket.amount), 1)
  const totalCompared = report.previousSummary.expenseTotal
  const changeText = report.expenseChangePercent === null ? '비교 기준 없음' :
    report.expenseChangePercent === 0 ? '변화 없음' : `${Math.abs(report.expenseChangePercent).toFixed(1)}% ${report.expenseChangePercent > 0 ? '증가' : '감소'}`

  return (
    <section aria-labelledby="reports-title">
      <div className="page-heading">
        <div><div className="eyebrow">REPORT</div><h1 id="reports-title">리포트</h1><p>월별 지출 흐름과 카테고리 변화를 리포트 목업으로 확인하세요.</p></div>
        <div className="month-switcher" aria-label="리포트 조회 월 선택">
          <button aria-label="이전 달" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft size={17} /></button>
          <strong>{monthLabel(month)}</strong>
          <button aria-label="다음 달" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight size={17} /></button>
        </div>
      </div>

      <div className="report-toolbar">
        <span className={`report-source ${usingSample ? 'sample' : ''}`}>{usingSample ? '예시 데이터 · 저장되지 않아요' : '내 거래 데이터'}</span>
        <div className="report-mode" aria-label="리포트 데이터 선택">
          <Button variant={showSample ? 'outline' : 'default'} size="sm" aria-pressed={!showSample} onClick={() => setShowSample(false)}>내 거래</Button>
          <Button variant={showSample ? 'default' : 'outline'} size="sm" aria-pressed={showSample} onClick={() => setShowSample(true)}>예시 리포트</Button>
        </div>
      </div>

      {!report.summary.transactionCount && <div className="notice" role="status">이 달에 저장된 거래가 없습니다. 예시 리포트로 화면을 체험해 보세요.</div>}

      <div className="summary-grid report-metrics">
        <div className="metric-card"><div className="metric-header"><span>이번 달 지출</span><span className="metric-icon expense"><TrendingUp size={18} /></span></div>
          <strong>{won(report.summary.expenseTotal)}</strong><small>총 {report.summary.transactionCount}건 기준</small></div>
        <div className="metric-card"><div className="metric-header"><span>전월 대비</span><span className="metric-icon balance"><TrendingDown size={18} /></span></div>
          <strong>{changeText}</strong><small>지난달 {won(totalCompared)}와 비교</small></div>
        <div className="metric-card difference"><div className="metric-header"><span>수입 대비 차액</span><span className="metric-icon income"><CircleDollarSign size={18} /></span></div>
          <strong>{report.savingsRate === null ? '수입 기록 없음' : `${report.savingsRate.toFixed(1)}%`}</strong><small>수입 − 지출 · 계좌 잔액과 달라요</small></div>
      </div>

      <div className="report-grid">
        <section className="surface-card report-card" aria-labelledby="weekly-report-title">
          <div className="card-heading"><div><div className="eyebrow">WEEKLY FLOW</div><h2 id="weekly-report-title">주차별 지출 흐름</h2></div><BarChart3 size={20} className="report-heading-icon" /></div>
          <p className="report-note">1일부터 7일씩 나눈 구간이에요.</p>
          <div className="weekly-chart">
            {report.weeklyExpenses.map((bucket) => (
              <div className="weekly-bar" key={bucket.label}>
                <span className="weekly-value">{won(bucket.amount)}</span>
                <div className="weekly-track"><span style={{ height: `${bucket.amount / biggestWeekly * 100}%` }} /></div>
                <strong>{bucket.label}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card report-card" aria-labelledby="category-report-title">
          <div className="card-heading"><div><div className="eyebrow">CATEGORY MIX</div><h2 id="category-report-title">카테고리 분석</h2></div><PieChart size={20} className="report-heading-icon" /></div>
          {report.summary.expensesByCategory.length ? <div className="report-category-list">
            {report.summary.expensesByCategory.map(({ category, amount }) => (
              <div className="report-category-row" key={category.id}>
                <span className="category-symbol" style={{ background: `${category.color}20`, color: category.color }}>{category.icon}</span>
                <div><strong>{category.name}</strong><div className="progress-track"><span style={{ width: `${Math.round(amount / report.summary.expenseTotal * 100)}%`, background: category.color }} /></div></div>
                <span>{won(amount)}<small>{Math.round(amount / report.summary.expenseTotal * 100)}%</small></span>
              </div>
            ))}
          </div> : <div className="empty-inline"><p>이 달에 분석할 지출이 없습니다.</p></div>}
        </section>
      </div>

      <section className="surface-card report-card report-comparison" aria-labelledby="report-comparison-title">
        <div className="card-heading"><div><div className="eyebrow">MONTH TO MONTH</div><h2 id="report-comparison-title">전월과 비교하기</h2></div></div>
        <p className="report-note">{monthLabel(shiftMonth(month, -1))} → {monthLabel(month)}</p>
        <div className="report-table-wrap"><table className="report-table"><thead><tr><th scope="col">항목</th><th scope="col">전월</th><th scope="col">선택한 달</th><th scope="col">변화</th></tr></thead>
          <tbody>{([
            ['수입', report.previousSummary.incomeTotal, report.summary.incomeTotal],
            ['지출', report.previousSummary.expenseTotal, report.summary.expenseTotal],
            ['차액', report.previousSummary.difference, report.summary.difference],
          ] as const).map(([label, previous, current]) => <tr key={label}><th scope="row">{label}</th><td>{won(previous)}</td><td>{won(current)}</td><td>{current > previous ? '+' : ''}{won(current - previous)}</td></tr>)}</tbody>
        </table></div>
        {!report.previousSummary.transactionCount && <p className="report-note">전월 기록이 없어 전월 금액은 0원으로 표시됩니다.</p>}
      </section>

      <section className="surface-card report-insight" aria-labelledby="report-insight-title">
        <div><div className="eyebrow">MOCK INSIGHT</div><h2 id="report-insight-title">이번 달 리포트 메모</h2></div>
        <p>{biggestCategory ? `${biggestCategory.category.name} 지출이 가장 크며 전체 지출의 ${Math.round(biggestCategory.amount / report.summary.expenseTotal * 100)}%를 차지해요.` : '이 달에 분석할 지출이 없습니다.'}<br />거래 합계로 만든 목 리포트예요. 실제 AI 분석은 연결되지 않았어요.</p>
      </section>
    </section>
  )
}
