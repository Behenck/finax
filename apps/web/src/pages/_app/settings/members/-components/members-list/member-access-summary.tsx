import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { MemberListItem } from './utils/types'

export function MemberAccessSummary({
  member,
  className,
}: {
  member: MemberListItem
  className?: string
}) {
  const accesses = member.accesses ?? []

  if (accesses.length === 0) {
    return <Badge variant="outline">Toda organização</Badge>
  }

  const companyWideCount = accesses.filter((access) => access.unitId === null).length
  const unitSpecificCount = accesses.filter((access) => access.unitId !== null).length
  const companyCount = new Set(accesses.map((access) => access.companyId)).size
  const groupedAccesses = Array.from(
    accesses.reduce(
      (acc, access) => {
        const current = acc.get(access.companyId) ?? {
          companyName: access.companyName,
          fullAccess: false,
          units: [] as string[],
        }

        if (access.unitId === null) {
          current.fullAccess = true
          current.units = []
        } else if (!current.fullAccess && access.unitName) {
          current.units.push(access.unitName)
        }

        acc.set(access.companyId, current)
        return acc
      },
      new Map<
        string,
        {
          companyName: string
          fullAccess: boolean
          units: string[]
        }
      >(),
    ).values(),
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex flex-wrap items-center gap-1', className)}>
          <Badge variant="outline" className='cursor-help'>
            {companyCount} empresa{companyCount > 1 ? 's' : ''}
          </Badge>
          {companyWideCount > 0 && (
            <Badge variant="outline" className='cursor-help'>
              {companyWideCount} completa{companyWideCount > 1 ? 's' : ''}
            </Badge>
          )}
          {unitSpecificCount > 0 && (
            <Badge variant="outline" className='cursor-help'>
              {unitSpecificCount} unidade{unitSpecificCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent sideOffset={8} className='max-w-80 rounded-lg px-3 py-2 text-xs'>
        <div className='space-y-2'>
          <p className='font-medium'>Acessos vinculados</p>
          <div className='space-y-1.5'>
            {groupedAccesses.map((group) => (
              <div key={group.companyName} className='leading-relaxed'>
                <p className='font-medium'>{group.companyName}</p>
                <p className='text-background/80'>
                  {group.fullAccess
                    ? 'Empresa inteira'
                    : group.units.length > 0
                      ? group.units.join(', ')
                      : 'Sem unidades específicas'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
