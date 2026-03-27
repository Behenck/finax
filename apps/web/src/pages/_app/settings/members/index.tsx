import { Card } from "@/components/ui/card";
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { createFileRoute } from '@tanstack/react-router'
import { MembersList } from './-components/members-list'
import { InviteMemberWithEmailAndRole } from './-components/invite-member-with-email-and-role'
import { InviteMemberLink } from './-components/invite-member-link'
import { InvitesPendingList } from './-components/invites-pending-list'
import { useApp } from '@/context/app-context'
import { useGetOrganizationsSlugMembers } from '@/http/generated'
import { useAbility } from "@/permissions/access";

export const Route = createFileRoute('/_app/settings/members/')({
  component: Members,
})

function Members() {
  const ability = useAbility()
  const { organization } = useApp()
  const canViewMembers = ability.can("access", "settings.members.view")
  const canManageMembers = ability.can("access", "settings.members.manage")
  const canAccessPage = canViewMembers
  const { data } = useGetOrganizationsSlugMembers(
    { slug: organization!.slug },
    {
      query: {
        enabled: canViewMembers,
      },
    },
  )

  const members = data?.members

  const totalMembers = members?.length ?? 0

  if (!canAccessPage) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Você não possui permissão para visualizar esta área.
        </p>
      </Card>
    )
  }

  return (
    <main className='flex flex-col gap-6'>
      {canManageMembers ? (
        <>
          <div className='grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start'>
            <InviteMemberLink />
            <InviteMemberWithEmailAndRole />
          </div>

          <Separator />
        </>
      ) : null}

      <div>
        <Tabs defaultValue="members" className="space-y-2">
          <TabsList
            variant="underline"
            className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border p-0 whitespace-nowrap"
          >
            {canViewMembers ? (
              <TabsTab
                value="members"
                className="
                  group relative rounded-none p-3 border-none
                  text-sm font-medium text-muted-foreground
                  hover:bg-transparent!
                  shrink-0
                "
              >Membros da organização ({totalMembers})</TabsTab>
            ) : null}
            {canViewMembers ? (
              <TabsTab
                value="members-pending"
                className="
                  group relative rounded-none p-3 border-none
                  text-sm font-medium text-muted-foreground
                  hover:bg-transparent!
                  shrink-0
                "
              >Convites pendentes</TabsTab>
            ) : null}
          </TabsList>
          {canViewMembers ? (
            <TabsPanel value="members">
              <MembersList />
            </TabsPanel>
          ) : null}
          {canViewMembers ? (
            <TabsPanel value="members-pending">
              <InvitesPendingList />
            </TabsPanel>
          ) : null}
        </Tabs>
      </div>
    </main>
  )
}
