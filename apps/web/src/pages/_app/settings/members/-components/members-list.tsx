import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/auth/use-session'
import { useMembers } from '@/hooks/members/use-members'
import { getInitials } from '@/utils/get-initials'
import { Ellipsis } from 'lucide-react'

export function MembersList() {
  const { data } = useSession()

  const user = data.user

  const { data: members } = useMembers("behenck")

  const totalMembers = members?.length

  return (
    <div className='space-y-2'>
      <div className='flex gap-2'>
        <Input placeholder={`Buscar membros`} />
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Permissão" defaultValue="member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Membro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card className='p-6 rounded-md'>
        <div className='flex gap-2'>
          <Checkbox />
          <Label className='text-xs text-muted-foreground'>Selecionar todos ({totalMembers})</Label>
        </div>

        {members?.map((member) => {
          const userLogged = !!(user?.id === member.userId)
          const owner = true

          return (
            <div className='flex items-center justify-between gap-2' key={member.id}>
              <div className='flex gap-2 items-center'>
                <Checkbox />
                <Avatar>
                  <AvatarImage src={member.avatarUrl ?? ""} />
                  <AvatarFallback>{getInitials(member.name ?? "")}</AvatarFallback>
                </Avatar>
                <div className='flex flex-col'>
                  <span className='font-medium'>{member.name} {userLogged && "(eu)"}</span>
                  <span className='text-xs text-muted-foreground'>{member.email}</span>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                {owner && (
                  <span className='text-sm text-muted-foreground'>Dono</span>
                )}
                <Button variant="outline" size="icon">
                  <Ellipsis />
                </Button>
              </div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}