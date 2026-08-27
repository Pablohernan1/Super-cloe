'use client'

import { useState } from 'react'
import { verifyAndFetchPortalData, type PortalData } from './actions'

const statusLabels: Record<string, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
  blocked: 'Bloqueada por mora',
  suspended: 'Suspendida',
}

const installmentStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagada',
  partial: 'Pago parcial',
  overdue: 'Vencida',
  cancelled: 'Cancelada',
}

function money(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

function date(s: string) {
  return new Date(s).toLocaleDateString('es-AR')
}

export function PortalClient({ token }: { token: string }) {
  const [last4, setLast4] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PortalData | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await verifyAndFetchPortalData(token, last4)
      if (!result.success || !result.data) {
        setError(result.error || 'No pudimos verificar tus datos.')
        return
      }
      setData(result.data)
    } finally {
      setLoading(false)
    }
  }

  if (!data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#B71C1C] text-white text-xl font-bold">C</div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Supermercado Cloe</h1>
          <p className="mt-1 text-sm text-gray-500">Consultá tu cuenta de financiación</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="last4" className="mb-1 block text-sm font-medium text-gray-700">
              Últimos 4 dígitos de tu DNI o CUIT
            </label>
            <input
              id="last4"
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-lg tracking-widest text-gray-900 placeholder:text-gray-400 focus:border-[#B71C1C] focus:outline-none focus:ring-1 focus:ring-[#B71C1C]"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || last4.length < 4}
            className="w-full rounded-lg bg-[#B71C1C] py-3 font-medium text-white transition-colors hover:bg-[#D32F2F] disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Ver mi cuenta'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          Este dato es solo para confirmar que sos vos. No lo compartimos con nadie.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-12">
      <div className="flex items-center gap-3 pt-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B71C1C] text-white font-bold">C</div>
        <div>
          <h1 className="font-bold text-gray-900">
            {data.customer.firstName} {data.customer.lastName}
          </h1>
          <p className="text-sm text-gray-500">Supermercado Cloe · Financiación propia</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Estado de cuenta</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              data.customer.status === 'active'
                ? 'bg-green-100 text-green-800'
                : data.customer.status === 'blocked'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
            }`}
          >
            {statusLabels[data.customer.status] || data.customer.status}
          </span>
        </div>
        {data.creditLimit && (
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <div>
              <p className="text-xs text-gray-500">Límite aprobado</p>
              <p className="font-semibold text-gray-900">{money(data.creditLimit.approvedLimit)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Disponible</p>
              <p className="font-semibold text-green-700">{money(data.creditLimit.availableCredit)}</p>
            </div>
          </div>
        )}
      </div>

      {data.customer.status === 'blocked' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Tu cuenta está bloqueada por atraso en cuotas. Acercate al supermercado para regularizar.
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-900">Préstamos</h2>
        {data.loans.length === 0 ? (
          <p className="text-sm text-gray-500">No tenés préstamos registrados.</p>
        ) : (
          <div className="space-y-4">
            {data.loans.map((loan) => (
              <div key={loan.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{loan.loanNumber}</span>
                  <span className="text-sm text-gray-500">{loan.termMonths} cuota(s) · {(loan.interestRate * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Capital {money(loan.principalAmount)} · Total {money(loan.totalAmount)}</span>
                  <span className="font-semibold text-gray-900">Saldo {money(loan.balance)}</span>
                </div>

                <div className="mt-3 space-y-1">
                  {loan.installments.map((inst) => (
                    <div key={inst.number} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        Cuota {inst.number} · vence {date(inst.dueDate)}
                      </span>
                      <span
                        className={
                          inst.status === 'paid'
                            ? 'text-green-700'
                            : inst.status === 'overdue'
                              ? 'text-red-700 font-medium'
                              : 'text-gray-700'
                        }
                      >
                        {money(inst.totalAmount)} · {installmentStatusLabels[inst.status] || inst.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-900">Historial de pagos</h2>
        {data.payments.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no registrás pagos.</p>
        ) : (
          <div className="space-y-2">
            {data.payments.map((p) => (
              <div key={p.paymentNumber} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {date(p.receivedAt)} · {p.loanNumber}
                </span>
                <span className="font-medium text-gray-900">{money(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400">
        Consulta informativa. Ante cualquier diferencia, acercate al supermercado.
      </p>
    </div>
  )
}
