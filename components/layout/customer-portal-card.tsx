'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Printer, QrCode } from 'lucide-react'

interface CustomerPortalCardProps {
  customerName: string
  customerCode: string | null
  portalToken: string
}

// Genera el QR localmente (nunca se manda el token a un servicio externo).
// Escanearlo abre el portal de consulta del cliente (ver decisión de
// arquitectura #4 en el skill) -- portal separado, hosteado en Vercel.
export function CustomerPortalCard({ customerName, customerCode, portalToken }: CustomerPortalCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const portalBaseUrl = process.env.NEXT_PUBLIC_PORTAL_BASE_URL || 'http://localhost:3002'
  const portalUrl = `${portalBaseUrl}/c/${portalToken}`

  useEffect(() => {
    QRCode.toDataURL(portalUrl, { width: 320, margin: 1, color: { dark: '#1F2937', light: '#FFFFFF' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [portalUrl])

  const handlePrint = () => {
    if (!printRef.current) return
    const printWindow = window.open('', '_blank', 'width=500,height=700')
    if (!printWindow) return

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Tarjeta - ${customerName}</title>
          <style>
            @page { size: 85mm 54mm; margin: 0; }
            body { margin: 0; font-family: system-ui, sans-serif; }
            .card {
              width: 85mm; height: 54mm; box-sizing: border-box; padding: 4mm;
              display: flex; align-items: center; gap: 4mm;
              border: 1px solid #D9DEE7;
            }
            .brand { color: #B71C1C; font-weight: 700; font-size: 12pt; }
            .name { font-weight: 600; font-size: 10pt; margin-top: 2mm; }
            .code { color: #6B7280; font-size: 8pt; }
            img { width: 30mm; height: 30mm; }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="${qrDataUrl}" alt="QR" />
            <div>
              <div class="brand">Supermercado Cloe</div>
              <div class="name">${customerName}</div>
              ${customerCode ? `<div class="code">${customerCode}</div>` : ''}
            </div>
          </div>
          <script>window.onload = () => { window.print(); }</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Tarjeta de consulta (QR)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          El cliente escanea este código con su celular para ver su cuenta, vencimientos e historial de pagos. Le
          va a pedir los últimos 4 dígitos de su documento antes de mostrar nada.
        </p>
        <div ref={printRef} className="flex items-center gap-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Código QR" className="h-32 w-32 rounded border" />
          ) : (
            <div className="h-32 w-32 rounded border bg-muted" />
          )}
          <Button onClick={handlePrint} variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir tarjeta
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
