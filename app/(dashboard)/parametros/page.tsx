'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { canManageParameters } from '@/lib/permissions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { ShieldAlert, Check } from 'lucide-react'
import type { Parameter } from '@/lib/types'

// Agrupación editorial de las claves sembradas en scripts/007 (spec sección
// 12). Cualquier parámetro nuevo que se agregue directo en la base cae en
// "Otros" sin romper la pantalla.
const GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'Tasas de interés y cuotas',
    keys: ['interest_rate_1_installment', 'interest_rate_2_installments', 'interest_rate_3_installments', 'max_installments'],
  },
  {
    title: 'Montos de préstamo',
    keys: ['min_loan_amount', 'max_loan_amount', 'max_loans_per_customer'],
  },
  {
    title: 'Mora y rehabilitación',
    keys: ['mora_grace_period_days', 'mora_daily_penalty_rate_pct', 'rehabilitation_mode'],
  },
  {
    title: 'Límites de crédito sugeridos',
    keys: ['credit_limit_base_1_guarantor', 'credit_limit_additional_2_guarantors'],
  },
  {
    title: 'Garantes',
    keys: ['max_guarantors_per_titular', 'max_titulares_per_guarantor', 'max_loans_guaranteed_per_guarantor'],
  },
  {
    title: 'Seguridad de sesión',
    keys: ['max_failed_logins', 'session_timeout_minutes'],
  },
]

// Las descripciones en la base incluyen referencias internas tipo "(spec 9)"
// para rastrear contra el PDF -- no le sirven a un administrador, se ocultan
// solo en pantalla sin tocar el dato guardado.
function displayDescription(param: Parameter) {
  return (param.description || param.key).replace(/\s*\(spec[^)]*\)\s*$/i, '')
}

function ParameterRow({
  param,
  value,
  onChange,
  onSave,
  saving,
  saved,
}: {
  param: Parameter
  value: string
  onChange: (value: string) => void
  onSave: () => void
  saving: boolean
  saved: boolean
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto] sm:items-end border-b pb-4 last:border-0 last:pb-0">
      <div>
        <Label className="text-sm font-medium">{displayDescription(param)}</Label>
      </div>
      <Input
        type={param.data_type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button size="sm" variant={saved ? 'outline' : 'default'} disabled={saving || value === param.value} onClick={onSave}>
        {saving ? <Spinner className="h-4 w-4" /> : saved ? <Check className="h-4 w-4 text-green-600" /> : 'Guardar'}
      </Button>
    </div>
  )
}

export default function ParametrosPage() {
  const supabase = createClient()
  const { profile } = useAuth()
  const canManage = canManageParameters(profile?.role)

  const [parameters, setParameters] = useState<Parameter[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('parameters').select('*').order('key')
      setParameters(data || [])
      const v: Record<string, string> = {}
      ;(data || []).forEach((p) => {
        v[p.key] = p.value
      })
      setValues(v)
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async (key: string) => {
    setSavingKey(key)
    setSavedKey(null)
    setError(null)
    const { error: updateError } = await supabase
      .from('parameters')
      .update({ value: values[key], updated_by: profile?.id })
      .eq('key', key)
    setSavingKey(null)
    if (updateError) {
      setError(`No se pudo guardar "${key}": ${updateError.message}`)
      return
    }
    setParameters((prev) => prev.map((p) => (p.key === key ? { ...p, value: values[key] } : p)))
    setSavedKey(key)
    setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000)
  }

  if (profile && !canManage) {
    return (
      <div className="space-y-6">
        <PageHeader title="Parámetros" description="Configuración de tasas, mora y límites del sistema" />
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>Esta sección es exclusiva de administrador.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">Cargando...</div>
  }

  const grouped = GROUPS.map((g) => ({
    ...g,
    params: g.keys.map((k) => parameters.find((p) => p.key === k)).filter((p): p is Parameter => Boolean(p)),
  })).filter((g) => g.params.length > 0)

  const groupedKeys = new Set(GROUPS.flatMap((g) => g.keys))
  const others = parameters.filter((p) => !groupedKeys.has(p.key))

  return (
    <div className="space-y-6">
      <PageHeader title="Parámetros" description="Configuración de tasas, mora y límites del sistema (spec sección 12)" />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {grouped.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-lg">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.params.map((p) => (
              <ParameterRow
                key={p.key}
                param={p}
                value={values[p.key] ?? ''}
                onChange={(v) => setValues((prev) => ({ ...prev, [p.key]: v }))}
                onSave={() => handleSave(p.key)}
                saving={savingKey === p.key}
                saved={savedKey === p.key}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Otros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {others.map((p) => (
              <ParameterRow
                key={p.key}
                param={p}
                value={values[p.key] ?? ''}
                onChange={(v) => setValues((prev) => ({ ...prev, [p.key]: v }))}
                onSave={() => handleSave(p.key)}
                saving={savingKey === p.key}
                saved={savedKey === p.key}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
