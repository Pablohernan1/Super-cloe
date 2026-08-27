import { PortalClient } from './portal-client'

export default async function CustomerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <PortalClient token={token} />
    </div>
  )
}
