'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <div className="max-w-md text-center">
            <h1 className="mb-2 text-2xl font-bold">Algo salió mal</h1>
            <p className="mb-4 text-gray-600">
              Hemos encontrado un error inesperado. Por favor, intenta de nuevo.
            </p>
            <button
              onClick={() => reset()}
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Intentar de Nuevo
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
