export const MEMBER_ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Membro' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'SELLER', label: 'Vendedor' },
  { value: 'PARTNER', label: 'Parceiro' },
] as const

export const MEMBER_ROLE_BADGE_CLASSNAME: Record<string, string> = {
  ADMIN: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  SUPERVISOR: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  MEMBER: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  SELLER: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  PARTNER: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
}
