import { createFileRoute } from '@tanstack/react-router'
import { InvitePage } from '../-components/invite-page'

export const Route = createFileRoute('/_auth/invite/$inviteId/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { inviteId } = Route.useParams()

  return <InvitePage inviteId={inviteId} />
}
