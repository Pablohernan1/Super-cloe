import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, RefreshCw } from 'lucide-react'

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-800',
}

const priorityLabels: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
}

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'blocked' | 'unblocked'>('all')

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      await supabase.rpc('refresh_mora_and_blocks')

      const { data: rawAlerts } = await supabase
        .from('alerts')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })

      const loanIds = Array.from(
        new Set((rawAlerts || []).filter((a) => a.reference_type === 'loan' && a.reference_id).map((a) => a.reference_id as string))
      )

      let loansById: Record<string, any> = {}
      if (loanIds.length > 0) {
        const { data: loans } = await supabase
          .from('loans')
          .select('id, loan_number, customer:customer_id (id, first_name, last_name, customer_code, status)')
          .in('id', loanIds)
        loansById = Object.fromEntries((loans || []).map((l: any) => [l.id, l]))
      }

      setAlerts((rawAlerts || []).map((a) => ({ ...a, loan: a.reference_id ? loansById[a.reference_id] : undefined })))
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  const filtered = alerts.filter((a) => {
    if (filter === 'blocked') return a.loan?.customer?.status === 'blocked'
    if (filter === 'unblocked') return a.loan?.customer?.status !== 'blocked'
    return true
  })

  const parseDays = (message: string) => {
    const match = message.match(/(\d+)\s+días/)
    return match ? match[1] : '-'
  }

  const parseSaldo = (message: string) => {
    const match = message.match(/saldo \$([\d.,]+)/)
    return match ? match[1] : '-'
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Alertas de mora" description="Seguimiento de cuentas morosas, vencidas y bloqueadas">
        <Button variant="outline" onClick={fetchAlerts} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Morosos, vencidos, bloqueados y garantes comprometidos</p>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="blocked">Bloqueados</SelectItem>
                <SelectItem value="unblocked">No bloqueados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Préstamo</TableHead>
                  <TableHead>Días</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Bloq.</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay alertas activas
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium">
                        {alert.loan?.customer ? `${alert.loan.customer.first_name} ${alert.loan.customer.last_name}` : '-'}
                      </TableCell>
                      <TableCell>{alert.loan?.loan_number || '-'}</TableCell>
                      <TableCell>{parseDays(alert.message)}</TableCell>
                      <TableCell>${parseSaldo(alert.message)}</TableCell>
                      <TableCell>
                        <Badge className={priorityColors[alert.priority]}>{priorityLabels[alert.priority] || alert.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        {alert.loan?.customer?.status === 'blocked' ? <Badge variant="destructive">Sí</Badge> : <Badge variant="secondary">No</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {alert.loan && (
                          <Link to={`/prestamos/${alert.loan.id}`}>
                            <Button variant="ghost" size="icon" title="Ver detalle">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
