import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, Ellipsis, X } from 'lucide-react'

interface MembersListProps {
  type?: "PENDING"
}

export function MembersList({ type }: MembersListProps) {
  return (
    <div className='space-y-2'>
      <div className='flex gap-2'>
        <Input placeholder={`Buscar ${type === "PENDING" ? "convites" : "membros"}`} />
        {type !== "PENDING" && (
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Permissão" defaultValue="member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Membro</SelectItem>
            </SelectContent>
          </Select>
        )}
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
            <div className='flex flex-col'>
              <span className='font-medium'>Denilson Behenck (eu)</span>
              <span className='text-xs text-muted-foreground'>denilsontrespa10@gmail.com</span>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>Dono</span>
            {type === "PENDING" ? (
              <>
                <Button variant="outline" size="icon">
                  <Check className='text-green-500' />
                </Button>
                <Button variant="outline" size="icon">
                  <X className='text-red-500' />
                </Button>
              </>
            ) : (
              <Button variant="outline" size="icon">
                <Ellipsis />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}