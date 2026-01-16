import { SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { AppContext } from '@/context/app-context'
import { auth } from '@/hooks/auth'
import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router'
import { AppSidebar } from './-components/sidebar'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  const { data, isPending } = auth.useSession()

  if (isPending) {
    return <Skeleton />
  }

  if (data == null) {
    return <Navigate to='/sign-in' replace />
  }

  return (
    <AppContext.Provider value={{ auth: data }}>
      <SidebarProvider>
        <AppSidebar />
        <main className='w-full'>
          <div className='p-10 h-full'>
            <Outlet />
          </div>
        </main>
      </SidebarProvider>
    </AppContext.Provider>
  )
}
