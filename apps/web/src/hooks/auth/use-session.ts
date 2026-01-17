import { api } from '@/lib/axios'
import { useQuery } from '@tanstack/react-query'
import Cookies from 'js-cookie'

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    retry: false,
    staleTime: Infinity,         
    gcTime: Infinity,            
    refetchOnMount: false,       
    refetchOnWindowFocus: false, 

    queryFn: async () => {
      const token = Cookies.get("token")
      if (!token) return null

      const { data } = await api.get('/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      return data.user
    },
  })
}
