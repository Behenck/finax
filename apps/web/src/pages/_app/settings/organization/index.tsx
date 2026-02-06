import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings/organization/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/settings/organization/"!</div>
}
