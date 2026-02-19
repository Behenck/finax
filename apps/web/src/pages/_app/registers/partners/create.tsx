import { createFileRoute } from '@tanstack/react-router'
import { FormPartner } from './-components/form-partner'

export const Route = createFileRoute('/_app/registers/partners/create')({
  component: CreatePartner,
})

function CreatePartner() {
  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cadastrar Parceiro</h1>
          <span className='text-xs text-muted-foreground'>Preencha os dados para cadastrar um novo parceiro.</span>
        </div>
      </header>

      <FormPartner />
    </main>)
}
