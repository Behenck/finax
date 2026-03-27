import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

type CompanyOption = {
  id: string
  name: string
  units: Array<{
    id: string
    name: string
  }>
}

export type MemberAccessScopeValue = {
  mode: 'ALL' | 'RESTRICTED'
  accesses: Array<{
    companyId: string
    unitId: string | null
  }>
}

type Props = {
  companies: CompanyOption[]
  value: MemberAccessScopeValue
  onChange: (value: MemberAccessScopeValue) => void
  className?: string
}

function uniqueAccesses(accesses: MemberAccessScopeValue['accesses']) {
  return Array.from(
    new Map(
      accesses.map((access) => [
        `${access.companyId}:${access.unitId ?? 'ALL'}`,
        { companyId: access.companyId, unitId: access.unitId ?? null },
      ]),
    ).values(),
  )
}

export function MemberAccessScopePicker({ companies, value, onChange, className }: Props) {
  const normalizedAccesses = uniqueAccesses(value.accesses)
  const [activeCompanyIds, setActiveCompanyIds] = useState<string[]>([])
  const normalizedCompanyIdsKey = normalizedAccesses
    .map((access) => access.companyId)
    .sort()
    .join('|')

  useEffect(() => {
    setActiveCompanyIds((prev) => {
      const fromAccesses = normalizedAccesses.map((access) => access.companyId)
      const next = Array.from(new Set([...prev, ...fromAccesses]))

      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev
      }

      return next
    })
  }, [normalizedCompanyIdsKey])

  const updateAccesses = (nextAccesses: MemberAccessScopeValue['accesses']) => {
    onChange({
      ...value,
      accesses: uniqueAccesses(nextAccesses),
    })
  }

  const setMode = (mode: MemberAccessScopeValue['mode']) => {
    onChange({
      mode,
      accesses: mode === 'ALL' ? [] : normalizedAccesses,
    })
  }

  const getCompanyAccesses = (companyId: string) =>
    normalizedAccesses.filter((access) => access.companyId === companyId)

  const toggleCompany = (companyId: string, checked: boolean) => {
    const base = normalizedAccesses.filter((access) => access.companyId !== companyId)
    setActiveCompanyIds((prev) =>
      checked ? Array.from(new Set([...prev, companyId])) : prev.filter((id) => id !== companyId),
    )

    if (!checked) {
      updateAccesses(base)
      return
    }

    updateAccesses([...base, { companyId, unitId: null }])
  }

  const toggleCompanyFullAccess = (companyId: string, checked: boolean) => {
    const base = normalizedAccesses.filter((access) => access.companyId !== companyId)
    setActiveCompanyIds((prev) => Array.from(new Set([...prev, companyId])))

    if (!checked) {
      updateAccesses(base)
      return
    }

    updateAccesses([...base, { companyId, unitId: null }])
  }

  const toggleUnit = (companyId: string, unitId: string, checked: boolean) => {
    const companyAccesses = getCompanyAccesses(companyId)
    const withoutCompany = normalizedAccesses.filter((access) => access.companyId !== companyId)
    const unitAccesses = companyAccesses.filter((access) => access.unitId !== null)
    setActiveCompanyIds((prev) => Array.from(new Set([...prev, companyId])))

    if (checked) {
      updateAccesses([
        ...withoutCompany,
        ...unitAccesses.filter((access) => access.unitId !== unitId),
        { companyId, unitId },
      ])
      return
    }

    const nextUnitAccesses = unitAccesses.filter((access) => access.unitId !== unitId)
    updateAccesses([...withoutCompany, ...nextUnitAccesses])
  }

  const selectedCompaniesCount = new Set(normalizedAccesses.map((access) => access.companyId)).size
  const selectedUnitsCount = normalizedAccesses.filter((access) => access.unitId !== null).length

  return (
    <div className={cn('space-y-3', className)}>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          size='sm'
          variant={value.mode === 'ALL' ? 'default' : 'outline'}
          onClick={() => setMode('ALL')}
        >
          Toda a organização
        </Button>
        <Button
          type='button'
          size='sm'
          variant={value.mode === 'RESTRICTED' ? 'default' : 'outline'}
          onClick={() => setMode('RESTRICTED')}
        >
          Restringir por empresa/unidade
        </Button>
      </div>

      <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
        <Badge variant='outline'>
          {value.mode === 'ALL' ? 'Acesso total' : 'Acesso restrito'}
        </Badge>
        {value.mode === 'RESTRICTED' && (
          <>
            <span>{selectedCompaniesCount} empresas</span>
            <span>•</span>
            <span>{selectedUnitsCount} unidades específicas</span>
          </>
        )}
      </div>

      {value.mode === 'RESTRICTED' && (
        <Card className='p-0'>
          <ScrollArea className='max-h-[min(60vh,38rem)]'>
            <div className='space-y-3 p-4'>
              {companies.length === 0 && (
                <p className='text-sm text-muted-foreground'>
                  Nenhuma empresa cadastrada para configurar acesso.
                </p>
              )}

              {companies.map((company) => {
                const companyAccesses = getCompanyAccesses(company.id)
                const companySelected =
                  companyAccesses.length > 0 || activeCompanyIds.includes(company.id)
                const companyFullAccess = companyAccesses.some((access) => access.unitId === null)
                const selectedUnitIds = new Set(
                  companyAccesses
                    .map((access) => access.unitId)
                    .filter((unitId): unitId is string => !!unitId),
                )

                return (
                  <div key={company.id} className='rounded-md border p-3 space-y-3'>
                    <div className='flex items-center justify-between gap-3'>
                      <div className='flex items-center gap-2'>
                        <Checkbox
                          checked={companySelected}
                          onCheckedChange={(checked) => toggleCompany(company.id, checked === true)}
                          id={`company-${company.id}`}
                        />
                        <Label htmlFor={`company-${company.id}`} className='font-medium'>
                          {company.name}
                        </Label>
                      </div>
                      <Badge variant='outline'>
                        {company.units.length > 0 ? `${company.units.length} unidades` : 'Sem unidades'}
                      </Badge>
                    </div>

                    {companySelected && company.units.length > 0 && (
                      <div className='space-y-2 rounded-md bg-muted/20 p-3'>
                        <div className='flex items-center gap-2'>
                          <Checkbox
                            checked={companyFullAccess}
                            onCheckedChange={(checked) =>
                              toggleCompanyFullAccess(company.id, checked === true)
                            }
                            id={`company-${company.id}-all`}
                          />
                          <Label htmlFor={`company-${company.id}-all`} className='text-sm'>
                            Acesso à empresa inteira
                          </Label>
                        </div>

                        <div className='grid gap-2 sm:grid-cols-2'>
                          {company.units.map((unit) => (
                            <div key={unit.id} className='flex items-center gap-2'>
                              <Checkbox
                                checked={selectedUnitIds.has(unit.id)}
                                disabled={companyFullAccess}
                                onCheckedChange={(checked) =>
                                  toggleUnit(company.id, unit.id, checked === true)
                                }
                                id={`unit-${unit.id}`}
                              />
                              <Label
                                htmlFor={`unit-${unit.id}`}
                                className={cn(
                                  'text-sm',
                                  companyFullAccess && 'text-muted-foreground',
                                )}
                              >
                                {unit.name}
                              </Label>
                            </div>
                          ))}
                        </div>

                        {!companyFullAccess && selectedUnitIds.size === 0 && (
                          <p className='text-xs text-muted-foreground'>
                            Selecione uma ou mais unidades para restringir o acesso desta empresa.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  )
}
