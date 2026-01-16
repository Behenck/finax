import { updateCompany } from '@/http/companies/update-company'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useUpdateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['companies'],
      })
      toast.success("Empresa atualizada com sucesso.")
    },
  })
}
