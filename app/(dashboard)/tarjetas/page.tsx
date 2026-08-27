'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Search, Printer, QrCode, ShieldAlert } from 'lucide-react'
import { openCardsPrintSheet } from '@/lib/print-cards'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth-context'

interface CustomerRow {
  id: string
  first_name: string
  last_name: string
  razon_social: string | null
  person_type: string
  customer_code: string | null
  cuit_cuil: string | null
  document_number: string
  status: string
  portal_token: string
}

const displayName = (c: CustomerRow) =>
  c.person_type === 'juridica' && c.razon_social ? c.razon_social : `${c.first_name} ${c.last_name}`

export default function TarjetasPage() {
  const { profile } = useAuth()
  const canManage = ['supervisor', 'administrador'].includes(profile?.role || '')
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('customers')
        .select('id, first_name, last_name, razon_social, person_type, customer_code, cuit_cuil, document_number, status, portal_token')
        .order('first_name', { ascending: true })
      setCustomers(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return (
      displayName(c).toLowerCase().includes(q) ||
      (c.customer_code || '').toLowerCase().includes(q) ||
      (c.cuit_cuil || '').includes(search) ||
      c.document_number.includes(search)
    )
  })

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const allSelected = filtered.every((c) => prev.has(c.id))
      const next = new Set(prev)
      if (allSelected) {
        filtered.forEach((c) => next.delete(c.id))
      } else {
        filtered.forEach((c) => next.add(c.id))
      }
      return next
    })
  }

  const handlePrint = async () => {
    const chosen = customers.filter((c) => selected.has(c.id))
    if (chosen.length === 0) return

    setPrinting(true)
    try {
      const portalBaseUrl = process.env.NEXT_PUBLIC_PORTAL_BASE_URL || 'http://localhost:3002'
      const cards = await Promise.all(
        chosen.map(async (c) => ({
          name: displayName(c),
          code: c.customer_code,
          qrDataUrl: await QRCode.toDataURL(`${portalBaseUrl}/c/${c.portal_token}`, {
            width: 320,
            margin: 1,
            color: { dark: '#1F2937', light: '#FFFFFF' },
          }),
        }))
      )
      openCardsPrintSheet(cards)
    } finally {
      setPrinting(false)
    }
  }

  if (profile && !canManage) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Tarjetas" description="Seleccioná clientes para imprimir sus tarjetas de consulta (QR) juntas" />
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>Esta sección es exclusiva de supervisor y administrador.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tarjetas" description="Seleccioná clientes para imprimir sus tarjetas de consulta (QR) juntas">
        <Button onClick={handlePrint} disabled={selected.size === 0 || printing}>
          {printing ? <Spinner className="mr-2 h-4 w-4" /> : <Printer className="mr-2 h-4 w-4" />}
          Imprimir {selected.size > 0 ? `(${selected.size})` : ''}
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, código, CUIT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={toggleAllFiltered}>
              {filtered.length > 0 && filtered.every((c) => selected.has(c.id)) ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No se encontraron clientes</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <QrCode className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{displayName(c)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.customer_code} · {c.cuit_cuil || c.document_number}
                    </p>
                  </div>
                  {c.status !== 'active' && (
                    <Badge variant="secondary" className="shrink-0">
                      {c.status}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
