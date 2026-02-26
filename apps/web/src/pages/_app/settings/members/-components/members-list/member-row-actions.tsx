import { useState } from 'react'
import { Ellipsis, KeyRound, Shield, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { MemberAccessManager } from './member-access-manager'
import { MemberRoleManager } from './member-role-manager'
import type { CompanyOption, MemberListItem } from './utils/types'

type Props = {
  member: MemberListItem
  owner: boolean
  userLogged: boolean
  organizationSlug: string
  companies: CompanyOption[]
  isLoadingCompanies: boolean
}

export function MemberRowActions({
  member,
  owner,
  userLogged,
  organizationSlug,
  companies,
  isLoadingCompanies,
}: Props) {
  const [accessSheetOpen, setAccessSheetOpen] = useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={`Ações de ${member.email}`}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className='w-52'>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              setRoleDialogOpen(true)
            }}
            disabled={owner}
          >
            <Shield className='size-4' />
            Alterar permissão
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              setAccessSheetOpen(true)
            }}
            disabled={owner}
          >
            <KeyRound className='size-4' />
            Acessos
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => toast.info('Fluxo de excluir membro pelo menu será conectado em seguida.')}
            disabled={owner || userLogged}
          >
            <Trash2 className='size-4' />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MemberAccessManager
        member={member}
        organizationSlug={organizationSlug}
        companies={companies}
        isLoadingCompanies={isLoadingCompanies}
        open={accessSheetOpen}
        onOpenChange={setAccessSheetOpen}
      />
      <MemberRoleManager
        member={member}
        organizationSlug={organizationSlug}
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
      />
    </>
  )
}
