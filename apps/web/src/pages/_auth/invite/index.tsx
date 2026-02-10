import { createFileRoute } from '@tanstack/react-router'
import { InvitePage } from './-components/invite-page';

export const Route = createFileRoute('/_auth/invite/')({
  component: () => <InvitePage />,
})