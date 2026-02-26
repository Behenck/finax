import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getOrganizationsSlugMembersQueryKey } from '@/http/generated'
import { api } from '@/lib/axios'

import { MEMBER_ROLE_OPTIONS } from './utils/constants'
import type { MemberListItem } from './utils/types'

type Props = {
  member: MemberListItem
  organizationSlug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MemberRoleManager({ member, organizationSlug, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [role, setRole] = useState(member.role)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (!open) {
      setRole(member.role)
    }
  }, [member.role, open])

  const handleSave = async () => {
    try {
      setIsPending(true)
      await api.patch(`/organizations/${organizationSlug}/members/${member.id}/role`, { role })

      await queryClient.invalidateQueries({
        queryKey: getOrganizationsSlugMembersQueryKey({ slug: organizationSlug }),
      })

      toast.success('Permissão do membro atualizada com sucesso.')
      onOpenChange(false)
    } catch (error) {
      toast.error((error as any)?.response?.data?.message ?? 'Erro ao atualizar permissão.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar permissão</DialogTitle>
          <DialogDescription>
            Atualize a permissão de <strong>{member.name ?? member.email}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-2 w-full'>
          <Label htmlFor={`member-role-${member.id}`}>Permissão</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id={`member-role-${member.id}`} className='w-full'>
              <SelectValue placeholder="Selecione uma permissão" />
            </SelectTrigger>
            <SelectContent>
              {MEMBER_ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending || role === member.role}>
            {isPending ? 'Salvando...' : 'Salvar permissão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
