import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { createFileRoute } from '@tanstack/react-router'
import { MembersList } from './-components/members-list'
import { InviteMemberWithEmailAndRole } from './-components/invite-member-with-email-and-role'
import { InviteMemberLink } from './-components/invite-member-link'
import { InvitesPendingList } from './-components/invites-pending-list'
import { useApp } from '@/context/app-context'
import { useGetOrganizationsSlugMembers } from '@/http/generated'

export const Route = createFileRoute('/_app/settings/members/')({
  component: Members,
})

function Members() {
  const { organization } = useApp()
  const { data } = useGetOrganizationsSlugMembers({ slug: organization!.slug })

  const members = data?.members

  const totalMembers = members?.length ?? 0
  return (
    <main className='flex flex-col gap-8'>
      <div className='flex items-center justify-between'>
        <InviteMemberLink />
        <InviteMemberWithEmailAndRole />
      </div>

      <Separator />

      <div>
        <Tabs defaultValue="members" className="space-y-2">
          <TabsList variant="underline" className="justify-start p-0 border-b border-gray-200 rounded-none h-auto w-full">
            <TabsTab
              value="members"
              className="
                group relative rounded-none p-3 border-none
                text-sm font-medium text-muted-foreground
                hover:bg-transparent!
                flex-0
              "
            >Membros da organização ({totalMembers})</TabsTab>
            <TabsTab
              value="members-pending"
              className="
                group relative rounded-none p-3 border-none
                text-sm font-medium text-muted-foreground
                hover:bg-transparent!
                flex-0
              "
            >Convites pendentes</TabsTab>
          </TabsList>
          <TabsPanel value="members">
            <MembersList />
          </TabsPanel>
          <TabsPanel value="members-pending">
            <InvitesPendingList />
          </TabsPanel>
        </Tabs>
      </div>
    </main>
  )
}
