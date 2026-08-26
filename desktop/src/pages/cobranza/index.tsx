import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function CobranzaPage() {
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()
  const canRehabilitate = ['supervisor', 'administrador'].includes(profile?.role || '')

  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState<any>(null)
  const [installments, setInstallments] = useState<any[]>([])
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
    else setSelectedInstallmentId('')
  }, [])

  useEffect(() => {
    const loanId = searchParams.get('loan_id')
    if (!loanId) return
    const load = async () => {
      const { data: loan } = await supabase.from('loans').select('customer_id').eq('id', loanId).single()
      if (loan) await loadForCustomer(loan.customer_id)
    }
    load()
  }, [searchParams, loadForCustomer])

  const handleSearch = async () => {
    if (!search) return
    setError(null)
    const { data } = await supabase
      .from('customers')
      .select('id')
      .or(`document_number.eq.${search},cuit_cuil.eq.${search}`)
      .limit(1)
      .maybeSingle()

    if (!data) {
      setError('No se encontró un cliente con ese CUIT/CUIL')
      setCustomer(null)
      setInstallments([])
      return
    }
    await loadForCustomer(data.id)
  }

  const selectedInstallment = installments.find((i) => i.id === selectedInstallmentId)
  const outstandingInstallment = selectedInstallment ? selectedInstallment.total_amount - selectedInstallment.paid_amount : 0
  const outstandingPenalty = selectedInstallment?.penalty_amount || 0
  const totalDue = outstandingInstallment + outstandingPenalty

  const handleRegister = async () => {
    if (!selectedInstallmentId || !amount) return
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('register_payment', {
        p_installment_id: selectedInstallmentId,
        p_amount: parseFloat(amount),
        p_payment_method: paymentMethod,
        p_reference_number: reference || null,
        p_notes: null,
      })
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      setResult(data)
      setAmount('')
      if (customer) await loadForCustomer(customer.id)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRehabilitate = async () => {
    if (!customer) return
    setIsLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('rehabilitate_customer', { p_customer_id: customer.id })
      if (rpcError || !data?.success) {
        setError(rpcError?.message || data?.error || 'No se pudo rehabilitar la cuenta')
        return
      }
      setResult({ rehabilitated: true })
      await loadForCustomer(customer.id)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Cobranza / rehabilitación" description="Registrar pago y normalizar cuentas en mora" />

      {!searchParams.get('loan_id') && (
        <Card>
          <CardHeader>
            <CardTitle>Buscar cliente</CardTitle>
            <CardDescription>Por CUIT/CUIL</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input placeholder="20-12345678-9" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

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
            Pago {result.payment_number} registrado. Aplicado a interés de mora: ${result.applied_penalty?.toLocaleString('es-AR')}, a
            cuota: ${result.applied_installment?.toLocaleString('es-AR')}.
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
                <CardDescription>
                  {customer.customer_code} · {customer.document_number}
                </CardDescription>
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
                  Pago mínimo de rehabilitación: regularizar las cuotas vencidas + interés de mora acumulado. El pago impacta titular y
                  garantes.
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
              <CardContent className="pt-6 text-center text-muted-foreground">Este cliente no tiene cuotas pendientes.</CardContent>
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
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={totalDue ? totalDue.toFixed(2) : '0.00'} />
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
