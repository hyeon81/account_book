import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { filterTransactions } from '@/application/ledger'
import { categories, categoryFor, dateLabel, monthLabel, shiftMonth, won } from '@/domain/transaction'
import type { Transaction, TransactionType } from '@/domain/transaction'
import { CategoryIcon } from './CategoryIcon'

type Props = {
  month: string
  onMonthChange: (month: string) => void
  transactions: Transaction[]
  onAdd: () => void
  onEdit: (transaction: Transaction) => void
  onDelete: (id: string) => void
}

export function TransactionsPage({ month, onMonthChange, transactions, onAdd, onEdit, onDelete }: Props) {
  const [type, setType] = useState<TransactionType | 'all'>('all')
  const [categoryId, setCategoryId] = useState('all')
  const [visible, setVisible] = useState(5)
  const [target, setTarget] = useState<Transaction | null>(null)
  const [error, setError] = useState('')
  const filtered = filterTransactions(transactions, { month, type, categoryId })
  const items = filtered.slice(0, visible)
  const setFilterType = (value: TransactionType | 'all') => { setType(value); setCategoryId('all'); setVisible(5) }
  const changeMonth = (value: string) => { onMonthChange(value); setVisible(5) }
  const remove = () => {
    if (!target) return
    try { onDelete(target.id); setTarget(null); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '삭제하지 못했어요.') }
  }

  return (
    <section aria-labelledby="transactions-title">
      <div className="page-heading">
        <div><h1 id="transactions-title">거래 내역</h1><p>기록한 거래를 확인하고 관리하세요.</p></div>
        <Button className="heading-add" onClick={onAdd}><Plus size={16} /> 거래 추가</Button>
      </div>
      <Card className="surface-card transaction-panel">
        <div className="transaction-toolbar">
          <div className="month-switcher compact" aria-label="거래 조회 월 선택">
            <Button variant="ghost" size="icon-sm" aria-label="이전 달" onClick={() => changeMonth(shiftMonth(month, -1))}><ChevronLeft size={17} /></Button>
            <strong>{monthLabel(month)}</strong>
            <Button variant="ghost" size="icon-sm" aria-label="다음 달" onClick={() => changeMonth(shiftMonth(month, 1))}><ChevronRight size={17} /></Button>
          </div>
          <div className="filters"><SlidersHorizontal size={16} className="filter-icon" aria-hidden="true" />
            <Select value={type} onValueChange={(value) => setFilterType(value as TransactionType | 'all')}>
              <SelectTrigger aria-label="거래 유형" className="filter-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">전체 유형</SelectItem><SelectItem value="income">수입</SelectItem><SelectItem value="expense">지출</SelectItem></SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={(value) => { setCategoryId(value); setVisible(5) }}>
              <SelectTrigger aria-label="카테고리" className="filter-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">전체 카테고리</SelectItem>
                {categories.filter((category) => type === 'all' || category.type === type).map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="transaction-list-heading"><strong>거래 목록</strong><Badge variant="secondary">{monthLabel(month)} · {filtered.length}건</Badge></div>
        {filtered.length === 0 ? <div className="list-state"><Search size={27} /><strong>조건에 맞는 거래가 없습니다.</strong><p>거래를 추가하거나 다른 월·필터를 선택해 보세요.</p>
            <Button variant="outline" onClick={() => { setFilterType('all'); setCategoryId('all') }}>필터 해제</Button></div> : <>
            <div className="transaction-table-head"><span>거래 내역</span><span>날짜</span><span>금액</span><span className="sr-only">행동</span></div>
            <div className="transaction-list">
              {items.map((item) => { const category = categoryFor(item.categoryId)
                return <div className="transaction-row" key={item.id}>
                  <CategoryIcon categoryId={item.categoryId} className="transaction-icon" />
                  <div className="transaction-description"><strong>{item.merchant || category?.name || '거래'}</strong><small>{category?.name} {item.memo && `· ${item.memo}`}</small></div>
                  <span className="transaction-date">{dateLabel(item.date)}</span>
                  <strong className={`transaction-amount ${item.type}`}>{item.type === 'income' ? '+' : '−'}{won(item.amount)}</strong>
                  <div className="row-actions"><Button variant="ghost" size="sm" onClick={() => onEdit(item)} aria-label={`${item.merchant || category?.name} 수정`}>수정</Button>
                    <Button variant="ghost" size="sm" onClick={() => setTarget(item)} aria-label={`${item.merchant || category?.name} 삭제`}>삭제</Button></div>
                </div>
              })}
            </div>
            {visible < filtered.length && <div className="load-more"><Button variant="outline" onClick={() => setVisible((count) => count + 5)}>더 보기</Button></div>}
          </>}
      </Card>
      <AlertDialog open={target !== null} onOpenChange={(open) => { if (!open) { setTarget(null); setError('') } }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>거래를 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>{target && `${dateLabel(target.date)} · ${target.merchant || categoryFor(target.categoryId)?.name} · ${won(target.amount)}`} 기록이 삭제됩니다. 이 작업은 되돌릴 수 없어요.</AlertDialogDescription>
        </AlertDialogHeader>{error && <p className="form-error" role="alert">{error}</p>}
          <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); remove() }}>삭제</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
