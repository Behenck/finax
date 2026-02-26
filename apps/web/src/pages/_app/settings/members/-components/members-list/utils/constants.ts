export const MEMBER_ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Membro' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'SELLER', label: 'Vendedor' },
  { value: 'PARTNER', label: 'Parceiro' },
] as const

export const MEMBER_ROLE_BADGE_CLASSNAME: Record<string, string> = {
  ADMIN: 'bg-rose-100 text-rose-800 border-rose-200',
  SUPERVISOR: 'bg-amber-100 text-amber-800 border-amber-200',
  MEMBER: 'bg-blue-100 text-blue-800 border-blue-200',
  SELLER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PARTNER: 'bg-violet-100 text-violet-800 border-violet-200',
}
