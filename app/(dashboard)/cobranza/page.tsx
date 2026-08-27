'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle, Search, HandCoins } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

interface Installment {
  id: string
  loan_id: string
  installment_number: number
  due_date: string
  total_amount: number
  paid_amount: number
  penalty_amount: number
  status: string
}

interface CustomerInfo {
  id: string
  first_name: string
  last_name: string
  customer_code: string
  document_number: string
  status: string
}

interface LoanRow {
  loanId: string
  loanNumber: string
  loanStatus: string
  customerId: string
  customerName: string
  customerCode: string
  customerDoc: string
  balance: number
  nextDueDate: string | null
  inMora: boolean
}

function CobranzaContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const { profile } = useAuth()
  const canRehabilitate = ['supervisor', 'administrador'].includes(profile?.role || '')

  const [search, setSearch] = useState('')
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [loadingLoans, setLoadingLoans] = useState(true)
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [selectedInstallmentId, setSelectedInstallmentId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  const loadForCustomer = useCallback(async (customerId: string) => {
    const { data: cust } = await supabase
      .from('customers')
      .select('id, first_name, last_name, customer_code, document_number, status')
      .eq('id', customerId)
      .single()

    setCustomer(cust)

    const { data: insts } = await supabase
      .from('installments')
      .select('id, loan_id, installment_number, due_date, total_amount, paid_amount, penalty_amount, status, loan:loan_id(customer_id)')
      .in('status', ['pending', 'partial', 'overdue'])
      .order('due_date', { ascending: true })

    const filtered = (insts || []).filter((i: any) => i.loan?.customer_id === customerId)
    setInstallments(filtered)
    if (filtered.length > 0) setSelectedInstallmentId(filtered[0].id)
  }, [supabase])

  // Préstamos con saldo pendiente (activos y en mora), para elegir de una
  // lista en vez de tener que buscar cliente por cliente.
  const loadLoansList = useCallback(async () => {
    setLoadingLoans(true)
    const { data } = await supabase
      .from('loans')
      .select(`
        id, loan_number, status,
        customer:customer_id ( id, first_name, last_name, customer_code, document_number, status ),
        installments ( id, due_date, total_amount, paid_amount, penalty_amount, status )
      `)
      .in('status', ['active', 'defaulted'])
      .order('created_at', { ascending: false })

    const rows: LoanRow[] = (data || [])
      .map((loan: any) => {
        const pending = (loan.installments || []).filter((i: any) => ['pending', 'partial', 'overdue'].includes(i.status))
        if (pending.length === 0 || !loan.customer) return null
        const balance = pending.reduce((sum: number, i: any) => sum + (i.total_amount - i.paid_amount + i.penalty_amount), 0)
        const nextDueDate = pending.map((i: any) => i.due_date).sort()[0] || null
        return {
          loanId: loan.id,
          loanNumber: loan.loan_number,
          loanStatus: loan.status,
          customerId: loan.customer.id,
          customerName: `${loan.customer.first_name} ${loan.customer.last_name}`,
          customerCode: loan.customer.customer_code,
          customerDoc: loan.customer.document_number,
          balance,
          nextDueDate,
          inMora: loan.status === 'defaulted' || loan.customer.status === 'blocked',
        }
      })
      .filter(Boolean) as LoanRow[]

    setLoans(rows)
    setLoadingLoans(false)
  }, [supabase])

  useEffect(() => {
    loadLoansList()
  }, [loadLoansList])

  // Vino desde el detalle de préstamo (?loan_id=...) o del acceso rápido
  // del dashboard (?customer_id=...)
  useEffect(() => {
    const loanId = searchParams.get('loan_id')
    const customerId = searchParams.get('customer_id')

    if (customerId) {
      loadForCustomer(customerId)
      return
    }

    if (!loanId) return

    const load = async () => {
      const { data: loan } = await supabase.from('loans').select('customer_id').eq('id', loanId).single()
      if (loan) await loadForCustomer(loan.customer_id)
    }
    load()
  }, [searchParams, loadForCustomer, supabase])

  const filteredLoans = loans.filter((l) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      l.customerName.toLowerCase().includes(q) ||
      (l.customerCode || '').toLowerCase().includes(q) ||
      l.customerDoc.includes(search) ||
      l.loanNumber.toLowerCase().includes(q)
    )
  })

  const selectedInstallment = installments.find((i) => i.id === selectedInstallmentId)
  const outstandingInstallment = selectedInstallment
    ? selectedInstallment.total_amount - selectedInstallment.paid_amount
    : 0
  const outstandingPenalty = selectedInstallment?.penalty_amount || 0
  const totalDue = outstandingInstallment + outstandingPenalty

  const handleRegister = async () => {
    if (!selectedInstallmentId || !amount) return
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/cobranza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installment_id: selectedInstallmentId,
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          reference_number: reference || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al registrar el pago')
        return
      }
      setResult(data)
      setAmount('')
      if (customer) await loadForCustomer(customer.id)
      loadLoansList()
    } catch (err) {
      setError('Error al registrar el pago')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRehabilitate = async () => {
    if (!customer) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cobranza', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customer.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo rehabilitar la cuenta')
        return
      }
      setResult({ rehabilitated: true })
      await loadForCustomer(customer.id)
      loadLoansList()
    } catch (err) {
      setError('Error al rehabilitar la cuenta')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Cobranza / rehabilitación" description="Registrar pago y normalizar cuentas en mora" />

      <Card>
        <CardHeader>
          <CardTitle>Préstamos con saldo pendiente</CardTitle>
          <CardDescription>Activos y en mora. Filtrá por nombre, código, documento o número de préstamo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Filtrar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Préstamo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Próx. Vencimiento</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLoans ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filteredLoans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay préstamos con saldo pendiente
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoans.map((l) => (
                    <TableRow key={l.loanId} className={customer?.id === l.customerId ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <p className="font-medium">{l.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.customerCode} · {l.customerDoc}
                        </p>
                      </TableCell>
                      <TableCell>{l.loanNumber}</TableCell>
                      <TableCell>
                        {l.inMora ? <Badge variant="destructive">Mora</Badge> : <Badge className="bg-green-100 text-green-800">Activo</Badge>}
                      </TableCell>
                      <TableCell className="text-right font-medium">${l.balance.toLocaleString('es-AR')}</TableCell>
                      <TableCell>{l.nextDueDate ? new Date(l.nextDueDate).toLocaleDateString('es-AR') : '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => loadForCustomer(l.customerId)}>
                          <HandCoins className="mr-2 h-4 w-4" />
                          Cobrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result?.rehabilitated && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Cuenta rehabilitada. Bloqueo levantado para el titular y garantes correspondientes.
          </AlertDescription>
        </Alert>
      )}

      {result?.success && !result.rehabilitated && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Pago {result.payment_number} registrado. Aplicado a interés de mora: ${result.applied_penalty?.toLocaleString('es-AR')},
            a cuota: ${result.applied_installment?.toLocaleString('es-AR')}.
          </AlertDescription>
        </Alert>
      )}

      {customer && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {customer.first_name} {customer.last_name}
                </CardTitle>
                <CardDescription>{customer.customer_code} · {customer.document_number}</CardDescription>
              </div>
              {customer.status === 'blocked' ? (
                <Badge variant="destructive">Cuenta bloqueada por mora</Badge>
              ) : (
                <Badge className="bg-green-100 text-green-800">Activa</Badge>
              )}
            </CardHeader>
            {customer.status === 'blocked' && (
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Pago mínimo de rehabilitación: regularizar las cuotas vencidas + interés de mora acumulado.
                  El pago impacta titular y garantes.
                </p>
                {canRehabilitate && (
                  <Button onClick={handleRehabilitate} disabled={isLoading} variant="outline">
                    Rehabilitar cuenta
                  </Button>
                )}
              </CardContent>
            )}
          </Card>

          {installments.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Este cliente no tiene cuotas pendientes.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Registrar pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Cuota</Label>
                    <Select value={selectedInstallmentId} onValueChange={setSelectedInstallmentId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {installments.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>
                            Cuota {inst.installment_number} · vence {new Date(inst.due_date).toLocaleDateString('es-AR')}
                            {inst.status === 'overdue' ? ' (vencida)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Medio de pago</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="debit">Débito</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                        <SelectItem value="discount">Descuento en cuenta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedInstallment && (
                  <div className="grid gap-4 md:grid-cols-3 rounded-lg border p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo de cuota</p>
                      <p className="font-medium">${outstandingInstallment.toLocaleString('es-AR')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interés mora</p>
                      <p className="font-medium text-destructive">${outstandingPenalty.toLocaleString('es-AR')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total a regularizar</p>
                      <p className="font-bold">${totalDue.toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Pago recibido</Label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={totalDue ? totalDue.toFixed(2) : '0.00'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Referencia (opcional)</Label>
                    <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                  </div>
                </div>

                <Button onClick={handleRegister} disabled={isLoading || !amount} className="w-full">
                  {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
                  Registrar pago
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

export default function CobranzaPage() {
  return (
    <Suspense fallback={<div className="p-6"><Spinner className="h-6 w-6" /></div>}>
      <CobranzaContent />
    </Suspense>
  )
}
