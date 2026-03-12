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
    <main className='flex flex-col gap-6'>
      <div className='grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start'>
        <InviteMemberLink />
        <InviteMemberWithEmailAndRole />
      </div>

      <Separator />

      <div>
        <Tabs defaultValue="members" className="space-y-2">
          <TabsList
            variant="underline"
            className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-gray-200 p-0 whitespace-nowrap"
          >
            <TabsTab
              value="members"
              className="
                group relative rounded-none p-3 border-none
                text-sm font-medium text-muted-foreground
                hover:bg-transparent!
                shrink-0
              "
            >Membros da organização ({totalMembers})</TabsTab>
            <TabsTab
              value="members-pending"
              className="
                group relative rounded-none p-3 border-none
                text-sm font-medium text-muted-foreground
                hover:bg-transparent!
                shrink-0
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
