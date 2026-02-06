import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Ellipsis } from 'lucide-react'

export function MembersList() {
  return (
    <div className='space-y-2'>
      <div className='flex gap-2'>
        <Input placeholder='Buscar membros' />
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
          <Label className='text-xs text-muted-foreground'>Selecionar todos (2)</Label>
        </div>

        <div className='flex items-center justify-between gap-2'>
          <div className='flex gap-2 items-center'>
            <Checkbox />
            <Avatar>
              <AvatarImage src='https://github.com.br/behenck.png' />
              <AvatarFallback>DB</AvatarFallback>
            </Avatar>
            <div className='flex flex-col gap-1'>
              <span className='font-medium'>Denilson Behenck (eu)</span>
              <span className='text-xs text-muted-foreground'>denilsontrespa10@gmail.com</span>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>Dono</span>
            <Button variant="outline" size="icon">
              <Ellipsis />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}