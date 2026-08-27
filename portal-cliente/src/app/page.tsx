export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#B71C1C] text-white text-xl font-bold">
        C
      </div>
      <h1 className="text-xl font-bold text-gray-900">Supermercado Cloe</h1>
      <p className="max-w-sm text-sm text-gray-500">
        Escaneá el código QR de tu tarjeta de financiación para consultar tu cuenta.
      </p>
    </div>
  )
}
