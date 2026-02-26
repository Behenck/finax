import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { TableCell, TableRow } from '@/components/ui/table'
import { getInitials } from '@/utils/get-initials'

import { MemberAccessSummary } from './member-access-summary'
import { MemberRowActions } from './member-row-actions'
import { MemberRoleBadge } from './member-role-badge'
import type { CompanyOption, MemberListItem } from './utils/types'

type Props = {
  member: MemberListItem
  ownerId?: string
  authUserId?: string
  organizationSlug: string
  companies: CompanyOption[]
  isLoadingCompanies: boolean
}

export function MemberRow({
  member,
  ownerId,
  authUserId,
  organizationSlug,
  companies,
  isLoadingCompanies,
}: Props) {
  const userLogged = authUserId === member.userId
  const owner = member.userId === ownerId

  return (
    <>
      <div className='rounded-xl border bg-background p-3 shadow-xs md:hidden'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2'>
            <Checkbox />
            <Avatar>
              <AvatarImage src={member.avatarUrl ?? ''} />
              <AvatarFallback>{getInitials(member.name ?? '')}</AvatarFallback>
            </Avatar>
            <div className='min-w-0'>
              <p className='truncate font-medium'>
                {member.name || 'Sem nome'} {userLogged && '(eu)'}
              </p>
              <p className='truncate text-xs text-muted-foreground'>{member.email}</p>
            </div>
          </div>
          <MemberRowActions
            member={member}
            owner={owner}
            userLogged={userLogged}
            organizationSlug={organizationSlug}
            companies={companies}
            isLoadingCompanies={isLoadingCompanies}
          />
        </div>

        <div className='mt-3 grid gap-3'>
          <div className='space-y-1'>
            <p className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>Permissão</p>
            {owner ? (
              <Badge variant="outline">Dono</Badge>
            ) : (
              <MemberRoleBadge role={member.role} />
            )}
          </div>
          <div className='space-y-1'>
            <p className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>Acessos</p>
            <MemberAccessSummary member={member} className='justify-start' />
          </div>
        </div>
      </div>

      <TableRow className='hidden md:table-row'>
        <TableCell className='px-3 py-3'>
          <div className='flex min-w-0 items-center gap-2'>
            <Checkbox />
            <Avatar>
              <AvatarImage src={member.avatarUrl ?? ''} />
              <AvatarFallback>{getInitials(member.name ?? '')}</AvatarFallback>
            </Avatar>
            <div className='min-w-0'>
              <p className='truncate font-medium'>
                {member.name || 'Sem nome'} {userLogged && '(eu)'}
              </p>
              <p className='truncate text-xs text-muted-foreground'>{member.email}</p>
            </div>
          </div>
        </TableCell>
        <TableCell className='px-3 py-3'>
          <div className='flex justify-center'>
            <MemberAccessSummary member={member} className='justify-center' />
          </div>
        </TableCell>
        <TableCell className='px-3 py-3'>
          {owner ? <Badge variant="outline">Dono</Badge> : <MemberRoleBadge role={member.role} />}
        </TableCell>
        <TableCell className='px-3 py-3 text-right'>
          <div className='flex justify-end'>
            <MemberRowActions
              member={member}
              owner={owner}
              userLogged={userLogged}
              organizationSlug={organizationSlug}
              companies={companies}
              isLoadingCompanies={isLoadingCompanies}
            />
          </div>
        </TableCell>
      </TableRow>
    </>
  )
}
