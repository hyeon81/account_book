import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { validateTransaction } from '@/application/ledger'
import type { InputErrors } from '@/application/ledger'
import { categories, seoulToday } from '@/domain/transaction'
import type { TransactionInput, TransactionType } from '@/domain/transaction'
import { CardMessageInput } from './CardMessageInput'
import { CategoryRecommendation } from './CategoryRecommendation'
import { useCategoryRecommendation } from './useCategoryRecommendation'

type Props = {
  open: boolean
  mode: 'create' | 'edit' | 'draft'
  initial?: TransactionInput
  cardMessage?: boolean
  onOpenChange: (open: boolean) => void
  onSave: (input: TransactionInput) => void
}

const emptyInput = (): TransactionInput => ({ date: seoulToday(), type: 'expense', amount: 0, categoryId: '', merchant: '', memo: '' })

export function TransactionForm({ open, mode, initial, cardMessage = false, onOpenChange, onSave }: Props) {
  const [input, setInput] = useState<TransactionInput>(initial ?? emptyInput)
  const [amountText, setAmountText] = useState(initial ? String(initial.amount) : '')
  const [errors, setErrors] = useState<InputErrors>({})
  const [generalError, setGeneralError] = useState('')
  const [cardBlocked, setCardBlocked] = useState(false)
  const recommendation = useCategoryRecommendation(open, input, mode === 'edit' ? initial : undefined, (categoryId) => {
    setInput((current) => ({ ...current, categoryId }))
    setErrors((current) => ({ ...current, categoryId: undefined }))
  })
  const changeOpen = (next: boolean) => { if (!next) recommendation.cancel(); onOpenChange(next) }
  const applyCardDraft = (draft: TransactionInput) => {
    recommendation.cancel()
    setInput(draft)
    setAmountText(String(draft.amount))
    setErrors({})
    setGeneralError('')
  }
  const update = <K extends keyof TransactionInput>(key: K, value: TransactionInput[K]) => {
    if (key === 'merchant' || key === 'memo' || key === 'categoryId' || key === 'type') recommendation.cancel()
    setInput((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (cardBlocked || recommendation.busy) return
    const next = { ...input, amount: Number(amountText) }
    const validation = validateTransaction(next)
    setErrors(validation)
    if (Object.keys(validation).length) return
    try { onSave(next); setGeneralError('') }
    catch (cause) { setGeneralError(cause instanceof Error ? cause.message : '거래를 저장하지 못했어요.') }
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogContent className="form-dialog"><DialogHeader><DialogTitle>{mode === 'edit' ? '거래 수정' : mode === 'draft' ? '초안 수정 후 저장' : '거래 추가'}</DialogTitle>
      <DialogDescription>거래 정보를 입력해 주세요. 금액은 원화로 기록됩니다.</DialogDescription></DialogHeader>
      {mode === 'create' && <CardMessageInput initiallyOpen={cardMessage} onDraft={applyCardDraft} onBlockedChange={setCardBlocked} />}
      <form onSubmit={submit} className="transaction-form" noValidate>
        {generalError && <p className="form-error" role="alert">{generalError}</p>}
        <div className="form-field"><Label htmlFor="transaction-date">거래일 <span className="required">*</span></Label>
          <Input id="transaction-date" type="date" value={input.date} onChange={(event) => update('date', event.target.value)} aria-invalid={!!errors.date} aria-describedby={errors.date ? 'date-error' : undefined} />
          {errors.date && <small id="date-error" className="field-error">{errors.date}</small>}</div>
        <div className="form-field"><Label htmlFor="transaction-type">유형 <span className="required">*</span></Label>
          <Select value={input.type} onValueChange={(value) => { recommendation.cancel(); setInput((current) => ({ ...current, type: value as TransactionType, categoryId: '' })) }}>
            <SelectTrigger id="transaction-type" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="expense">지출</SelectItem><SelectItem value="income">수입</SelectItem></SelectContent>
          </Select></div>
        <div className="form-field"><Label htmlFor="transaction-amount">금액 <span className="required">*</span></Label>
          <div className="amount-input"><Input id="transaction-amount" type="number" min="1" step="1" inputMode="numeric" placeholder="0" value={amountText}
            onChange={(event) => { setAmountText(event.target.value); setErrors((current) => ({ ...current, amount: undefined })) }}
            aria-invalid={!!errors.amount} aria-describedby={errors.amount ? 'amount-error' : undefined} /><span>원</span></div>
          {errors.amount && <small id="amount-error" className="field-error">{errors.amount}</small>}</div>
        <div className="form-field"><Label htmlFor="transaction-category">카테고리 <span className="required">*</span></Label>
          <Select value={input.categoryId} onValueChange={(value) => update('categoryId', value)}>
            <SelectTrigger id="transaction-category" className="w-full" aria-invalid={!!errors.categoryId}><SelectValue placeholder="카테고리를 선택해 주세요" /></SelectTrigger>
            <SelectContent>{categories.filter((item) => item.type === input.type).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
          </Select>{errors.categoryId && <small className="field-error" role="alert">{errors.categoryId}</small>}
          <CategoryRecommendation busy={recommendation.busy} enabled={Boolean(input.merchant.trim() || input.memo.trim()) && !cardBlocked}
            result={recommendation.result} notice={recommendation.notice} onRecommend={recommendation.recommend} /></div>
        <div className="form-field"><Label htmlFor="transaction-merchant">{input.type === 'income' ? '지급처' : '사용처'} <span className="optional">선택</span></Label>
          <Input id="transaction-merchant" placeholder={input.type === 'income' ? '예: 회사' : '예: 동네 마트'} value={input.merchant} onChange={(event) => update('merchant', event.target.value)} /></div>
        <div className="form-field"><Label htmlFor="transaction-memo">메모 <span className="optional">선택</span></Label>
          <Textarea id="transaction-memo" placeholder="기억해 둘 내용을 남겨 보세요" rows={3} value={input.memo} onChange={(event) => update('memo', event.target.value)} /></div>
        <DialogFooter className="form-actions"><Button type="button" variant="outline" onClick={() => changeOpen(false)}>취소</Button>
          <Button type="submit" disabled={cardBlocked || recommendation.busy}>{mode === 'edit' ? '변경 저장' : '거래 저장'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
