import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const { pathname } = useLocation()
  const isMobile = useIsMobile()
  const orientation = isMobile ? 'horizontal' : 'vertical'

  const activeTab =
    pathname.startsWith('/settings/members')
      ? 'members'
      : pathname.startsWith('/settings/organization')
        ? 'organization'
        : 'general'

  return (
    <div className="flex w-full flex-col gap-4 md:gap-6">
      <h1 className="text-xl font-bold sm:text-2xl">Configurações</h1>
      <Tabs orientation={orientation} className="w-full items-start gap-4 md:gap-6" value={activeTab}>
        <TabsList
          variant="underline"
          className={cn(
            orientation === 'vertical'
              ? 'w-full max-w-52 items-start'
              : 'w-full justify-start overflow-x-auto border-b border-border whitespace-nowrap',
          )}
        >
          <Link to="/settings" className='shrink-0'>
            <TabsTab value="general" className={cn(orientation === 'horizontal' && 'shrink-0')}>Geral</TabsTab>
          </Link>
          <Link to="/settings/organization" className='shrink-0'>
            <TabsTab value="organization" className={cn(orientation === 'horizontal' && 'shrink-0')}>Organização</TabsTab>
          </Link>
          <Link to="/settings/members" className='shrink-0'>
            <TabsTab value="members" className={cn(orientation === 'horizontal' && 'shrink-0')}>Membros</TabsTab>
          </Link>
        </TabsList>
        <div className='w-full min-w-0 flex-1 md:max-w-4xl'>
          <Outlet />
        </div>
      </Tabs>
    </div >)
}
