import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const { pathname } = useLocation()

  const activeTab =
    pathname.startsWith('/settings/members')
      ? 'members'
      : pathname.startsWith('/settings/organization')
        ? 'organization'
        : 'general'

  return (
    <div className="flex flex-col gap-8 h-screen">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <Tabs orientation="vertical" className="items-start" value={activeTab}>
        <TabsList variant="underline" className="items-start">
          <Link to="/settings">
            <TabsTab value="general">Geral</TabsTab>
          </Link>
          <Link to="/settings/organization">
            <TabsTab value="organization">Organização</TabsTab>
          </Link>
          <Link to="/settings/members">
            <TabsTab value="members">Membros</TabsTab>
          </Link>
        </TabsList>
        <div className='flex-1 max-w-4xl mx-auto'>
          <Outlet />
        </div>
      </Tabs>
    </div >)
}
