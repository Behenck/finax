import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/sign-out')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_auth/sign-out"!</div>
}