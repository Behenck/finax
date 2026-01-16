import { updateUnit } from '@/http/units/update-unit'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useUpdateUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['units'],
      })
      queryClient.invalidateQueries({
        queryKey: ['companies'],
      })
      toast.success("Unidade atualizada com sucesso.")
    },
  })
}
