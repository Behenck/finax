import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useApp } from '@/context/app-context'
import { useMemo, useState } from 'react'
import { useGetOrganizationsSlugCompanies, useGetOrganizationsSlugMembers } from '@/http/generated'

import { MemberRow } from './member-row'
import type { MemberListItem, RoleFilter } from './utils/types'
import { filterMembers } from './utils'

export function MembersList() {
  const { auth, organization } = useApp()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')

  if (!organization) return null

  const { data } = useGetOrganizationsSlugMembers({ slug: organization!.slug })
  const { data: companiesData, isLoading: isLoadingCompanies } = useGetOrganizationsSlugCompanies({
    slug: organization.slug,
  })

  const members = (data?.members as MemberListItem[] | undefined)
  const companies = companiesData?.companies ?? []

  const filteredMembers = useMemo(
    () => filterMembers(members, search, roleFilter),
    [members, roleFilter, search],
  )

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
          onValueChange={(value) => setRoleFilter(value as RoleFilter)}
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
      <div className='space-y-3'>
        <div className='flex items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3'>
          <Checkbox />
          <Label className='text-xs text-muted-foreground'>
            Selecionar todos ({filteredMembers.length} de {totalMembers})
          </Label>
        </div>

        <div className='px-1 py-1 md:hidden'>
          <div className='space-y-2 md:hidden'>
            {filteredMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                ownerId={organization.ownerId}
                authUserId={auth?.id}
                organizationSlug={organization.slug}
                companies={companies}
                isLoadingCompanies={isLoadingCompanies}
              />
            ))}
          </div>
        </div>

        <div className='hidden overflow-hidden rounded-xl border bg-background md:block'>
          <Table>
            <TableHeader>
              <TableRow className='bg-muted/40 hover:bg-muted/40'>
                <TableHead className='h-12 px-3 text-xs uppercase tracking-wide text-muted-foreground'>Membro</TableHead>
                <TableHead className='h-12 px-3 text-center text-xs uppercase tracking-wide text-muted-foreground'>Acessos</TableHead>
                <TableHead className='h-12 px-3 text-center text-xs uppercase tracking-wide text-muted-foreground'>Permissão</TableHead>
                <TableHead className='h-12 px-3 text-right text-xs uppercase tracking-wide text-muted-foreground'>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  ownerId={organization.ownerId}
                  authUserId={auth?.id}
                  organizationSlug={organization.slug}
                  companies={companies}
                  isLoadingCompanies={isLoadingCompanies}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {filteredMembers.length === 0 && (
        <div className='rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground'>
          Nenhum membro encontrado com os filtros atuais.
        </div>
      )}
    </div>
  )
}
