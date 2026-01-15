import { useMutation, useQueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { postSessionsPassword } from "@/http/generated/hooks"

type SignInInput = {
  email: string
  password: string
}

export function useSignIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SignInInput) => {
      const data = await postSessionsPassword(payload)
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
