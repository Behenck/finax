import { useSignOut } from '@/hooks/auth/use-sign-out'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

export const Route = createFileRoute('/_auth/sign-out')({
  component: RouteComponent,
})

function RouteComponent() {
  const hasTriggeredRef = useRef(false)
  const { mutate: signOut, isPending } = useSignOut()

  useEffect(() => {
    if (hasTriggeredRef.current) {
      return
    }

    hasTriggeredRef.current = true
    signOut()
  }, [signOut])

  return (
    <div className="text-sm text-muted-foreground">
      {isPending ? "Saindo..." : "Redirecionando..."}
    </div>
  )
}
