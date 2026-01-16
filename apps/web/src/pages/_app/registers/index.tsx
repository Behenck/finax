import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, Network, Plus, Tags } from 'lucide-react'
import { Categories } from './-tabs/categories'
import { Companies } from './-tabs/companies'
import { CostCenters } from './-tabs/cost-centers'
import { Employees } from './-tabs/employees'

export const Route = createFileRoute('/_app/registers/')({
  component: Registers,
})

function Registers() {
  return (
    <Tabs defaultValue="companies" className="space-y-4 rounded">
      <TabsList>
        <TabsTab value="companies" className="flex items-center gap-2 py-2 px-8 rounded">
          <Building2 />
          <span className='font-medium'>Empresas</span>
        </TabsTab>
        <TabsTab value="categories" className="flex items-center gap-2 py-2 px-8 rounded">
          <Tags />
          <span className='font-medium'>Categorias</span>
        </TabsTab>
        <TabsTab value="corsCenters" className="flex items-center gap-2 py-2 px-8 rounded">
          <Network />
          <span className='font-medium'>Centro de Custos</span>
        </TabsTab>
        <TabsTab value="employees" className="flex items-center gap-2 py-2 px-8 rounded">
          <Network />
          <span className='font-medium'>Funcionários</span>
        </TabsTab>
      </TabsList>
      <TabsPanel value="companies">
        <Companies />
      </TabsPanel>
      <TabsPanel value="categories">
        <Categories />
      </TabsPanel>
      <TabsPanel value="corsCenters">
        <CostCenters />
      </TabsPanel>
      <TabsPanel value="employees">
        <Employees />
      </TabsPanel>
    </Tabs>
  )
}
