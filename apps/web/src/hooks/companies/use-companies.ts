import { getCompanies } from '@/http/companies/get-companies'
import { useQuery } from '@tanstack/react-query'

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
  })
}