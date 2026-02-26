import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  getOrganizationsSlugMembersQueryKey,
  usePutOrganizationsSlugMembersMemberid,
} from '@/http/generated'

import { MemberAccessScopePicker, type MemberAccessScopeValue } from '../member-access-scope-picker'
import { MemberAccessSummary } from './member-access-summary'
import type { CompanyOption, MemberListItem } from './utils/types'
import { getMemberScope } from './utils'

type Props = {
  member: MemberListItem
  organizationSlug: string
  companies: CompanyOption[]
  isLoadingCompanies: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MemberAccessManager({
  member,
  organizationSlug,
  companies,
  isLoadingCompanies,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient()
  const [scope, setScope] = useState<MemberAccessScopeValue>(() => getMemberScope(member))
  const { mutateAsync: updateMember, isPending } = usePutOrganizationsSlugMembersMemberid()

  useEffect(() => {
    if (!open) {
      setScope(getMemberScope(member))
    }
  }, [member, open])

  const handleSave = async () => {
    try {
      await updateMember({
        slug: organizationSlug,
        memberId: member.id,
        data: {
          role: member.role,
          accessScope: scope,
        } as any,
      })

      await queryClient.invalidateQueries({
        queryKey: getOrganizationsSlugMembersQueryKey({ slug: organizationSlug }),
      })

      toast.success('Acessos do membro atualizados com sucesso.')
      onOpenChange(false)
    } catch (error) {
      toast.error((error as any)?.response?.data?.message ?? 'Erro ao atualizar acessos do membro.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className='w-full sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>Gerenciar acessos</SheetTitle>
          <SheetDescription>
            Defina as empresas e unidades que <strong>{member.name ?? member.email}</strong> pode acessar.
          </SheetDescription>
        </SheetHeader>

        <div className='px-4 space-y-4'>
          <Card className='p-4 space-y-2'>
            <div className='flex flex-col'>
              <span className='text-sm font-medium'>{member.name ?? 'Sem nome'}</span>
              <span className='text-xs text-muted-foreground'>{member.email}</span>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Badge variant="secondary">{member.role}</Badge>
              <MemberAccessSummary member={member} />
            </div>
          </Card>

          <Separator />

          {isLoadingCompanies ? (
            <div className='text-sm text-muted-foreground'>Carregando empresas...</div>
          ) : (
            <MemberAccessScopePicker companies={companies} value={scope} onChange={setScope} />
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending || isLoadingCompanies}>
            {isPending ? 'Salvando...' : 'Salvar acessos'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
