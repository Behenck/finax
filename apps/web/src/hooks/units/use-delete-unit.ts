import { deleteUnit } from '@/http/units/delete-unit'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useDeleteUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success("Unidade removida com sucesso.")
    },
  })
}
