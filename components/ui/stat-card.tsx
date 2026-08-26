import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    label: string
  }
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info'
  className?: string
}

export function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-success/10 border-success/20',
    warning: 'bg-warning/10 border-warning/20',
    destructive: 'bg-destructive/10 border-destructive/20',
    info: 'bg-info/10 border-info/20',
  }

  const iconStyles = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning-foreground',
    destructive: 'bg-destructive/20 text-destructive',
    info: 'bg-info/20 text-info',
  }

  return (
    <Card className={cn(variantStyles[variant], className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 text-sm">
                {trend.value > 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-success" />
                ) : trend.value < 0 ? (
                  <ArrowDownRight className="h-4 w-4 text-destructive" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    'font-medium',
                    trend.value > 0 && 'text-success',
                    trend.value < 0 && 'text-destructive',
                    trend.value === 0 && 'text-muted-foreground'
                  )}
                >
                  {trend.value > 0 ? '+' : ''}
                  {trend.value}%
                </span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                iconStyles[variant]
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
