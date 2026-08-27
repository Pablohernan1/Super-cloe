export interface PrintableCard {
  name: string
  code: string | null
  qrDataUrl: string
}

// Hoja con varias tarjetas (85x54mm cada una, tamaño tarjeta física
// estándar) para imprimir de una vez. A diferencia de la tarjeta
// individual, acá no se fija el tamaño de página a una sola tarjeta --
// se dejan fluir en la hoja y el navegador pagina solo si no entran todas.
export function openCardsPrintSheet(cards: PrintableCard[]) {
  if (cards.length === 0) return

  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) return

  const cardsHtml = cards
    .map(
      (c) => `
        <div class="card">
          <img src="${c.qrDataUrl}" alt="QR" />
          <div>
            <div class="brand">Supermercado Cloe</div>
            <div class="name">${c.name}</div>
            ${c.code ? `<div class="code">${c.code}</div>` : ''}
          </div>
        </div>
      `
    )
    .join('')

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Tarjetas Cloe</title>
        <style>
          @page { margin: 10mm; }
          body { margin: 0; font-family: system-ui, sans-serif; }
          .sheet { display: flex; flex-wrap: wrap; gap: 4mm; }
          .card {
            width: 85mm; height: 54mm; box-sizing: border-box; padding: 4mm;
            display: flex; align-items: center; gap: 4mm;
            border: 1px solid #D9DEE7; page-break-inside: avoid;
          }
          .brand { color: #B71C1C; font-weight: 700; font-size: 12pt; }
          .name { font-weight: 600; font-size: 10pt; margin-top: 2mm; }
          .code { color: #6B7280; font-size: 8pt; }
          img { width: 30mm; height: 30mm; flex-shrink: 0; }
        </style>
      </head>
      <body>
        <div class="sheet">${cardsHtml}</div>
        <script>window.onload = () => { window.print(); }</script>
      </body>
    </html>
  `)
  printWindow.document.close()
}
