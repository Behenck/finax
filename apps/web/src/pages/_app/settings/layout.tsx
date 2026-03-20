import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { useAbility } from '@/permissions/access'
import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const ability = useAbility()
  const { pathname } = useLocation()
  const isMobile = useIsMobile()
  const orientation = isMobile ? 'horizontal' : 'vertical'
  const canAccessOrganizationSettings =
    ability.can('access', 'settings.organization.view') ||
    ability.can('access', 'settings.organization.update')
  const canAccessMembersSettings =
    ability.can('access', 'settings.members.view') ||
    ability.can('access', 'settings.permissions.manage')

  const activeTab =
    canAccessMembersSettings && pathname.startsWith('/settings/members')
      ? 'members'
      : canAccessOrganizationSettings && pathname.startsWith('/settings/organization')
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
          {canAccessOrganizationSettings ? (
            <Link to="/settings/organization" className='shrink-0'>
              <TabsTab value="organization" className={cn(orientation === 'horizontal' && 'shrink-0')}>Organização</TabsTab>
            </Link>
          ) : null}
          {canAccessMembersSettings ? (
            <Link to="/settings/members" className='shrink-0'>
              <TabsTab value="members" className={cn(orientation === 'horizontal' && 'shrink-0')}>Membros</TabsTab>
            </Link>
          ) : null}
        </TabsList>
        <div className='w-full min-w-0 flex-1 md:max-w-4xl'>
          <Outlet />
        </div>
      </Tabs>
    </div >)
}
