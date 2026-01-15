import { postSessionsPassword } from '@sass/api-client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'

type SignInInput = {
  email: string
  password: string
}

export function useSignIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SignInInput) => {
      const { data } = await postSessionsPassword({ data: payload })
      return data
    },

    onSuccess: async (data) => {
      Cookies.set("token", data.accessToken)

      await queryClient.invalidateQueries({
        queryKey: ['session'],
      })
    },
  })
}
