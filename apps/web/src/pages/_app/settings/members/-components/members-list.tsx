import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/context/app-context'
import { useGetOrganizationsSlugMembers } from '@/http/generated'
import { getInitials } from '@/utils/get-initials'
import { Ellipsis } from 'lucide-react'
import { useMemo, useState } from 'react'

export function MembersList() {
  const { auth, organization } = useApp()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "MEMBER">("ALL")

  if (!organization) return null

  const { data } = useGetOrganizationsSlugMembers({ slug: organization!.slug })

  const members = data?.members

  const filteredMembers = useMemo(() => {
    const items = members ?? []
    const query = search.trim().toLowerCase()

    return items.filter((member) => {
      const matchesSearch =
        !query ||
        member.name?.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)

      const matchesRole = roleFilter === "ALL" || member.role === roleFilter

      return matchesSearch && matchesRole
    })
  }, [members, roleFilter, search])

  const totalMembers = members?.length ?? 0

  return (
    <div className='space-y-2'>
      <div className='flex gap-2'>
        <Input
          placeholder="Buscar por nome ou email"
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
            Selecionar todos ({filteredMembers.length} de {totalMembers})
          </Label>
        </div>

        {filteredMembers.map((member) => {
          const userLogged = auth?.id === member.userId
          const owner = member.userId === organization?.ownerId

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
                <span className='text-xs text-muted-foreground'>{member.role}</span>
                <Button variant="outline" size="icon">
                  <Ellipsis />
                </Button>
              </div>
            </div>
          )
        })}

        {filteredMembers.length === 0 && (
          <div className='py-6 text-sm text-muted-foreground'>
            Nenhum membro encontrado com os filtros atuais.
          </div>
        )}
      </Card>
    </div>
  )
}
