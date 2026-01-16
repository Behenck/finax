import { getCategories } from '@/http/categories/get-categories'
import { useQuery } from '@tanstack/react-query'

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  })
}