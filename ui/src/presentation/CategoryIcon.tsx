import { Banknote, CircleDollarSign, Coffee, HeartPulse, House, ShoppingBag, TrainFront, Utensils, Wallet } from 'lucide-react'

const icons = {
  salary: Wallet,
  'other-income': Banknote,
  food: Utensils,
  cafe: Coffee,
  shopping: ShoppingBag,
  transport: TrainFront,
  living: House,
  health: HeartPulse,
}

export function CategoryIcon({ categoryId, className = 'category-symbol' }: { categoryId: string; className?: string }) {
  const Icon = icons[categoryId as keyof typeof icons] ?? CircleDollarSign
  return <span className={className} aria-hidden="true"><Icon size={18} strokeWidth={1.7} /></span>
}
