import type {
  MemberDataScopeValue,
  MemberListItem,
  RoleFilter,
} from './types'
import type { MemberAccessScopeValue } from '../../member-access-scope-picker'
import { MEMBER_ROLE_BADGE_CLASSNAME, MEMBER_ROLE_OPTIONS } from './constants'

export function getMemberScope(member: MemberListItem): MemberAccessScopeValue {
  const accesses = (member.accesses ?? []).map((access) => ({
    companyId: access.companyId,
    unitId: access.unitId ?? null,
  }))

  return {
    mode: accesses.length > 0 ? 'RESTRICTED' : 'ALL',
    accesses,
  }
}

export function getMemberDataScopes(member: MemberListItem): {
  customersScope: MemberDataScopeValue
  salesScope: MemberDataScopeValue
  commissionsScope: MemberDataScopeValue
} {
  return {
    customersScope: member.customersScope ?? 'ORGANIZATION_ALL',
    salesScope: member.salesScope ?? 'ORGANIZATION_ALL',
    commissionsScope: member.commissionsScope ?? 'ORGANIZATION_ALL',
  }
}

export function filterMembers(
  members: MemberListItem[] | undefined,
  search: string,
  roleFilter: RoleFilter,
) {
  const items = members ?? []
  const query = search.trim().toLowerCase()

  return items.filter((member) => {
    const matchesSearch =
      !query ||
      member.name?.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)

    const matchesRole = roleFilter === 'ALL' || member.role === roleFilter

    return matchesSearch && matchesRole
  })
}

export function getMemberRoleLabel(role: string) {
  return MEMBER_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

export function getMemberRoleBadgeClassName(role: string) {
  return MEMBER_ROLE_BADGE_CLASSNAME[role] ?? 'bg-muted text-foreground border-border'
}
