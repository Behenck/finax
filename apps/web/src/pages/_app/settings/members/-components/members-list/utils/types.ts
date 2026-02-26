export type MemberAccess = {
  companyId: string
  companyName: string
  unitId: string | null
  unitName: string | null
}

export type MemberListItem = {
  id: string
  userId: string
  role: string
  name: string | null
  avatarUrl: string | null
  email: string
  accesses?: MemberAccess[]
}

export type CompanyOption = {
  id: string
  name: string
  units: Array<{
    id: string
    name: string
  }>
}

export type RoleFilter = 'ALL' | 'ADMIN' | 'MEMBER'

