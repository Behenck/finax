import { Input } from "@/components/ui/input";
import { useCompanies } from "@/hooks/companies/use-companies";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CompanyCard } from "./-components/company-card";
import { CreateCompany } from "./-components/create-company";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute('/_app/registers/companies/')({
  component: Companies,
})

function Companies() {
  const [search, setSearch] = useState('')
  const { data: companies, isLoading, isError } = useCompanies()

  const safeCompanies = companies ?? []

  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return safeCompanies

    const query = search.toLowerCase()

    return safeCompanies.filter(company => {
      const companyMatch = company.name.toLowerCase().includes(query)

      const unitMatch = company.units?.some(unit =>
        unit.name.toLowerCase().includes(query)
      )

      return companyMatch || unitMatch
    })
  }, [safeCompanies, search])

  if (isLoading) return <h1>Carregando...</h1>

  if (isError) {
    return <p className="text-destructive">Erro ao carregar empresas.</p>
  }

  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Gerenciar Empresas
        </h1>

        <CreateCompany />
      </header>

      <div className='relative'>
        <Search className='absolute left-5 top-1/2 -translate-1/2 size-4 text-gray-500' />
        <Input
          placeholder="Buscar por nome ou CNPJ..."
          className="max-w-[40%] h-10 pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <section className="space-y-4">
        {filteredCompanies?.map((company) => (
          <CompanyCard company={company} />
        ))}
      </section>
    </main>
  )
}