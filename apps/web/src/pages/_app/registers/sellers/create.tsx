import { createFileRoute } from '@tanstack/react-router'
import { FormSeller } from './-components/form-seller'

export const Route = createFileRoute('/_app/registers/sellers/create')({
  component: CreateSeller,
})

function CreateSeller() {
  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cadastrar Vendedor</h1>
          <span className='text-xs text-muted-foreground'>Preencha os dados para cadastrar um novo vendedor.</span>
        </div>
      </header>

      <FormSeller />
    </main>)
}
