import { cn } from '@/lib/utils'

interface CurrencyDisplayProps {
  amount: number
  currency?: string
  locale?: string
  className?: string
  showSign?: boolean
}

export function CurrencyDisplay({
  amount,
  currency = 'ARS',
  locale = 'es-AR',
  className,
  showSign = false,
}: CurrencyDisplayProps) {
  const formattedAmount = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))

  const sign = showSign && amount > 0 ? '+' : ''

  return (
    <span
      className={cn(
        'tabular-nums',
        amount < 0 && 'text-destructive',
        amount > 0 && showSign && 'text-success',
        className
      )}
    >
      {amount < 0 ? '-' : sign}
      {formattedAmount}
    </span>
  )
}

// Utility function for formatting currency without component
export function formatCurrency(
  amount: number,
  currency = 'ARS',
  locale = 'es-AR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
