import { Badge } from '@/components/ui/badge'

import { getMemberRoleBadgeClassName, getMemberRoleLabel } from './utils'

export function MemberRoleBadge({ role }: { role: string }) {
  return (
    <Badge
      variant="outline"
      className={getMemberRoleBadgeClassName(role)}
      title={getMemberRoleLabel(role)}
    >
      {getMemberRoleLabel(role)}
    </Badge>
  )
}

