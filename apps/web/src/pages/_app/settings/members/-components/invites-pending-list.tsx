import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UseInvites } from '@/hooks/invites/use-invites'
import { useApp } from '@/context/app-context'
import { X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMemo, useState } from 'react'

export function InvitesPendingList() {
  const { organization } = useApp()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "MEMBER">("ALL")

  const { data: invites } = UseInvites(organization?.slug ?? "")

  const filteredInvites = useMemo(() => {
    const items = invites ?? []
    const query = search.trim().toLowerCase()

    return items.filter((invite) => {
      const matchesSearch =
        !query ||
        invite.email.toLowerCase().includes(query) ||
        invite.author?.name?.toLowerCase().includes(query)

      const matchesRole = roleFilter === "ALL" || invite.role === roleFilter

      return matchesSearch && matchesRole
    })
  }, [invites, roleFilter, search])

  const totalInvites = invites?.length ?? 0

  return (
    <div className='space-y-2'>
      <div className='flex gap-2'>
        <Input
          placeholder="Buscar por email ou autor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={roleFilter}
          onValueChange={(value) => setRoleFilter(value as "ALL" | "ADMIN" | "MEMBER")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Permissão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas permissões</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="MEMBER">Membro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card className='p-6 rounded-md'>
        <div className='flex gap-2'>
          <Checkbox />
          <Label className='text-xs text-muted-foreground'>
            Selecionar todos ({filteredInvites.length} de {totalInvites})
          </Label>
        </div>

        {filteredInvites.map((invite) => {
          return (
            <div className='flex items-center justify-between gap-2' key={invite.id}>
              <div className='flex gap-2 items-center'>
                <Checkbox />
                <div className='flex flex-col'>
                  <span className='text-sm'>{invite.email ?? "Convite via link"}</span>
                  <span className='text-xs text-muted-foreground'>
                    {invite.role} • {invite.author?.name ?? "Sem autor"}
                  </span>
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

        {filteredInvites.length === 0 && (
          <div className='py-6 text-sm text-muted-foreground'>
            Nenhum convite pendente encontrado com os filtros atuais.
          </div>
        )}
      </Card>
    </div>
  )
}
