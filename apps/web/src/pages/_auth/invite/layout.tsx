import { Outlet } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/invite')({
  component: InviteLayout,
})

function InviteLayout() {
  return <Outlet />
}
