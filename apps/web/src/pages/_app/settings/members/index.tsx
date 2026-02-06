import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { createFileRoute } from '@tanstack/react-router'
import { LinkIcon } from 'lucide-react'
import { MembersList } from './-components/members-list'

export const Route = createFileRoute('/_app/settings/members/')({
  component: Members,
})

function Members() {
  return (
    <main className='flex flex-col gap-8'>
      <div className='flex items-center justify-between'>
        <div className='flex flex-col gap-2'>
          <div>
            <h2>Convidar membro</h2>
            <p className='text-sm text-muted-foreground'>convidar membro via link</p>
          </div>
          <Button variant="outline" size="sm">
            <LinkIcon />
            Convidas via link
          </Button>
        </div>
        <div className='space-y-2 w-md'>
          <div className='flex items-center gap-2'>
            <FieldGroup>
              <Field className='gap-1'>
                <FieldLabel>Email</FieldLabel>
                <Input placeholder="joao.silva@dominio.com" />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field className='gap-1'>
                <FieldLabel>Permissão</FieldLabel>
                <Select defaultValue="member">
                  <SelectTrigger>
                    <SelectValue placeholder="Permissão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Membro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

          </div>
          <Button className='w-full'>Enviar convite</Button>
        </div>
      </div>

      <Separator />

      <div>
        <Tabs defaultValue="overview" className="space-y-2">
          <TabsList variant="underline" className="justify-start p-0 border-b border-gray-200 rounded-none h-auto w-full">
            <TabsTab
              value="members"
              className="
                group relative rounded-none p-3 border-none
                text-sm font-medium text-muted-foreground
                hover:bg-transparent!
                flex-0
              "
            >Membros da organização (12)</TabsTab>
            <TabsTab
              value="members-pending"
              className="
                group relative rounded-none p-3 border-none
                text-sm font-medium text-muted-foreground
                hover:bg-transparent!
                flex-0
              "
            >Convites pendentes (3)</TabsTab>
          </TabsList>
          <TabsPanel value="members">
            <MembersList />
          </TabsPanel>
          <TabsPanel value="members-pending">
            <MembersList type='PENDING' />
          </TabsPanel>
        </Tabs>
      </div>
    </main>
  )
}
