import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UseInvites } from '@/hooks/invites/use-invites'
import { Check, X } from 'lucide-react'

export function InvitesPendingList() {
  const { data: invites } = UseInvites("behenck")

  const totalInvites = invites?.length

  return (
    <div className='space-y-2'>
      <div className='flex gap-2'>
        <Input placeholder={`Buscar convites`} />
      </div>
      <Card className='p-6 rounded-md'>
        <div className='flex gap-2'>
          <Checkbox />
          <Label className='text-xs text-muted-foreground'>Selecionar todos ({totalInvites})</Label>
        </div>

        {invites?.map((invite) => {
          return (
            <div className='flex items-center justify-between gap-2' key={invite.id}>
              <div className='flex gap-2 items-center'>
                <Checkbox />
                <div className='flex flex-col'>
                  <span className='text-sm'>{invite.email ?? "Convite via link"}</span>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <Button variant="outline" size="icon">
                  <X className='text-red-500' />
                </Button>
              </div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}