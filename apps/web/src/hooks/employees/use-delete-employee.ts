import { deleteEmployee } from '@/http/employees/delete-employee'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useDeleteEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['employees'],
      })
      toast.success("Funcionário removido com sucesso.")
    },
  })
}
