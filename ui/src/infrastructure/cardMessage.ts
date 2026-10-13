import type { TransactionInput } from '../domain/transaction.ts'

export type CardMessageParseResult =
  | { kind: 'draft'; draft: TransactionInput; categoryReason: string }
  | UnsupportedResult

type UnsupportedResult = { kind: 'unsupported'; reason: string }

const BLOCKED_MESSAGE = /(취소|취소완료|승인취소|거절|실패|불가|해외|USD|JPY|EUR|CNY|달러|엔화|유로)/
const AUXILIARY_AMOUNT = /(누적|한도|잔액|잔여|사용가능|총\s*이용|월\s*이용|포인트)/
const PURCHASE_HINT = /(승인|이용|결제|일시불|체크승인|매출)/
const ISSUER_OR_ACCOUNT =
  /(카드|체크|고객|회원|님|승인번호|[0-9*]{2,}[-*][0-9*-]+|^(KB|BC|NH|국민|신한|삼성|현대|롯데|우리|하나|비씨|농협|카카오|토스)\s*(카드|체크)?$)/

type LocatedMatch = { value: string; lineIndex: number; index: number; end: number }

export function parseCardMessage(message: string, today: string): CardMessageParseResult {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return unsupported('붙여넣은 카드 메시지가 비어 있습니다.')
  if (BLOCKED_MESSAGE.test(message)) return unsupported('승인된 국내 원화 결제 문자만 지원합니다.')

  const date = findSingleDate(lines, today)
  if ('kind' in date) return date

  const amount = findSingleAmount(lines)
  if ('kind' in amount) return amount

  if (!PURCHASE_HINT.test(message) && date.lineIndex !== amount.lineIndex) {
    return unsupported('카드 결제 승인 문자 형식으로 인식되지 않았습니다.')
  }

  const merchant = findMerchant(lines, date, amount)
  if (!merchant) return unsupported('상호명을 찾을 수 없습니다.')

  const category = classifyMerchant(merchant)

  return {
    kind: 'draft',
    draft: {
      date: date.date,
      type: 'expense',
      amount: amount.amount,
      categoryId: category.categoryId,
      merchant,
      memo: '카드 문자 붙여넣기 초안',
    },
    categoryReason: category.reason,
  }
}

function unsupported(reason: string): UnsupportedResult {
  return { kind: 'unsupported', reason }
}

function findSingleAmount(lines: string[]): UnsupportedResult | { amount: number; lineIndex: number; match: LocatedMatch } {
  const amounts: Array<{ amount: number; lineIndex: number; match: LocatedMatch }> = []

  lines.forEach((line, lineIndex) => {
    if (/\d+,\d{1,2}(?!\d)\s*원/.test(line) || /\d+,\d{4,}\s*원/.test(line)) return
    for (const match of line.matchAll(/(?<![\d,])([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?![\d,])\s*원/g)) {
      const prefix = line.slice(Math.max(0, (match.index ?? 0) - 8), match.index ?? 0)
      if (AUXILIARY_AMOUNT.test(prefix)) continue
      const amount = Number(match[1].replaceAll(',', ''))
      if (Number.isSafeInteger(amount) && amount > 0) {
        amounts.push({
          amount,
          lineIndex,
          match: { value: match[0], lineIndex, index: match.index ?? 0, end: (match.index ?? 0) + match[0].length },
        })
      }
    }
  })

  if (amounts.length === 0) return unsupported('결제 금액을 찾을 수 없습니다.')
  if (amounts.length > 1) return unsupported('한 번에 하나의 카드 결제 문자만 붙여넣어 주세요.')
  return amounts[0]
}

function findSingleDate(lines: string[], today: string): UnsupportedResult | { date: string; lineIndex: number; match: LocatedMatch } {
  const dates: Array<{ date: string; lineIndex: number; match: LocatedMatch }> = []

  lines.forEach((line, lineIndex) => {
    for (const match of line.matchAll(/(20\d{2})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/g)) {
      const date = buildDate(Number(match[1]), Number(match[2]), Number(match[3]))
      if (date) dates.push({ date, lineIndex, match: locate(match, lineIndex) })
    }
    for (const match of line.matchAll(/(?<![\d./-])(\d{1,2})[./-](\d{1,2})\s+\d{1,2}:\d{2}(?![\d./-])/g)) {
      const date = inferDate(Number(match[1]), Number(match[2]), today)
      if (date) dates.push({ date, lineIndex, match: locate(match, lineIndex) })
    }
  })

  const uniqueDates = [...new Map(dates.map((item) => [item.date, item])).values()]
  if (uniqueDates.length === 0) return unsupported('결제일을 찾을 수 없습니다.')
  if (uniqueDates.length > 1) return unsupported('한 번에 하나의 카드 결제 문자만 붙여넣어 주세요.')
  return uniqueDates[0]
}

function locate(match: RegExpMatchArray, lineIndex: number): LocatedMatch {
  return {
    value: match[0],
    lineIndex,
    index: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }
}

function inferDate(month: number, day: number, today: string): string | null {
  const [todayYear, todayMonth] = today.split('-').map(Number)
  const year = todayMonth === 1 && month === 12 ? todayYear - 1 : todayYear
  return buildDate(year, month, day)
}

function buildDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function findMerchant(
  lines: string[],
  date: { match: LocatedMatch },
  amount: { lineIndex: number; match: LocatedMatch },
): string {
  const sameLine = cleanMerchant(
    removeLocatedText(lines[amount.lineIndex].slice(amount.match.end), date.match),
  )
  if (sameLine) return sameLine

  const first = Math.min(date.match.lineIndex, amount.lineIndex)
  const last = Math.max(date.match.lineIndex, amount.lineIndex)
  const candidateIndexes = [
    ...range(first + 1, last),
    ...range(last + 1, lines.length),
  ].filter((index) => index !== date.match.lineIndex && index !== amount.lineIndex)

  for (const index of candidateIndexes) {
    const cleaned = cleanMerchant(removeLocatedText(removeLocatedText(lines[index], amount.match), date.match))
    if (cleaned) return cleaned
  }

  return ''
}

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, index) => start + index)
}

function removeLocatedText(line: string, match: LocatedMatch): string {
  if (!line.includes(match.value)) return line
  return line.replace(match.value, ' ')
}

function cleanMerchant(value: string): string {
  const cleaned = value
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/20\d{2}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2}(?:일)?(?:\s+\d{1,2}:\d{2})?/g, ' ')
    .replace(/(?<![\d./-])\d{1,2}[./-]\d{1,2}\s+\d{1,2}:\d{2}(?![\d./-])/g, ' ')
    .replace(/(?<!\d)\d{1,2}:\d{2}(?!\d)/g, ' ')
    .replace(/(누적|한도|잔액|잔여|사용가능|총\s*이용|월\s*이용|포인트).*$/g, ' ')
    .replace(PURCHASE_HINT, ' ')
    .replace(/일시불|할부|체크|승인번호\s*\S+|사용/g, ' ')
    .replace(/[0-9*]{2,}[-*][0-9*-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:.,/()]+|[\s:.,/()]+$/g, '')

  if (!cleaned || cleaned.length < 2) return ''
  if (AUXILIARY_AMOUNT.test(cleaned) || ISSUER_OR_ACCOUNT.test(cleaned)) return ''
  if (/^[가-힣]{2,4}$/.test(cleaned) && /(성|현|준|민|영|희|수|지|은|원|훈|호)$/.test(cleaned)) return ''
  return cleaned
}

function classifyMerchant(merchant: string): { categoryId: string; reason: string } {
  const rules: Array<{ categoryId: string; reason: string; pattern: RegExp }> = [
    { categoryId: 'cafe', reason: '카페 상호 규칙과 일치합니다.', pattern: /(스타벅스|투썸|메가커피|이디야|커피|카페|빽다방)/i },
    { categoryId: 'transport', reason: '교통 결제 규칙과 일치합니다.', pattern: /(버스|지하철|택시|티머니|카카오T|코레일|KTX|주유|충전소)/i },
    { categoryId: 'food', reason: '식비 상호 규칙과 일치합니다.', pattern: /(식당|음식|배달|치킨|피자|김밥|분식|버거|맥도날드|롯데리아|요기요|배민|쿠팡이츠)/i },
    { categoryId: 'shopping', reason: '쇼핑 상호 규칙과 일치합니다.', pattern: /(쿠팡|네이버페이|무신사|지마켓|11번가|올리브영)/i },
    { categoryId: 'health', reason: '건강 관련 상호 규칙과 일치합니다.', pattern: /(약국|병원|의원|치과|한의원|헬스)/i },
    { categoryId: 'living', reason: '생활 결제 규칙과 일치합니다.', pattern: /(편의점|GS25|CU|세븐일레븐|마트|다이소|전기|가스|관리비)/i },
  ]
  const matched = rules.find((rule) => rule.pattern.test(merchant))
  return matched ? { categoryId: matched.categoryId, reason: matched.reason } : { categoryId: '', reason: '명확한 상호 규칙이 없어 사용자가 카테고리를 선택해야 합니다.' }
}
