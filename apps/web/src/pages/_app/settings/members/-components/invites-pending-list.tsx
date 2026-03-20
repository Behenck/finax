import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UseInvites } from '@/hooks/invites/use-invites'
import { roleFilterParser, textFilterParser } from '@/hooks/filters/parsers'
import { useApp } from '@/context/app-context'
import { X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMemo } from 'react'
import { useQueryState } from 'nuqs'

const ROLE_FILTER_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Membro' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'SELLER', label: 'Vendedor' },
  { value: 'PARTNER', label: 'Parceiro' },
] as const

export function InvitesPendingList() {
  const { organization } = useApp()
  const [search, setSearch] = useQueryState("invitesQ", textFilterParser)
  const [roleFilter, setRoleFilter] = useQueryState("invitesRole", roleFilterParser)

  const { data: invites } = UseInvites(organization?.slug ?? "")

  const filteredInvites = useMemo(() => {
    const items = invites ?? []
    const query = search.trim().toLowerCase()

    return items.filter((invite) => {
      const matchesSearch =
        !query ||
        (invite.email ?? "").toLowerCase().includes(query) ||
        invite.author?.name?.toLowerCase().includes(query)

      const matchesRole = roleFilter === "ALL" || invite.role === roleFilter

      return matchesSearch && matchesRole
    })
  }, [invites, roleFilter, search])

  const totalInvites = invites?.length ?? 0

  return (
    <div className='space-y-3'>
      <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]'>
        <Input
          placeholder="Buscar por email ou autor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={roleFilter}
          onValueChange={(value) =>
            setRoleFilter(
              value as
                | "ALL"
                | "ADMIN"
                | "MEMBER"
                | "SUPERVISOR"
                | "SELLER"
                | "PARTNER",
            )
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue placeholder="Permissão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas permissões</SelectItem>
            {ROLE_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card className='space-y-3 rounded-md p-4 sm:p-6'>
        <div className='flex flex-wrap items-center gap-2'>
          <Checkbox />
          <Label className='text-xs text-muted-foreground'>
            Selecionar todos ({filteredInvites.length} de {totalInvites})
          </Label>
        </div>

        {filteredInvites.map((invite) => {
          return (
            <div className='flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between' key={invite.id}>
              <div className='flex min-w-0 gap-2 items-center'>
                <Checkbox />
                <div className='flex min-w-0 flex-col'>
                  <span className='truncate text-sm'>{invite.email ?? "Convite via link"}</span>
                  <span className='text-xs text-muted-foreground'>
                    {invite.role} • {invite.author?.name ?? "Sem autor"}
                  </span>
                </div>
              </div>
              <div className='flex items-center justify-end gap-2'>
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
