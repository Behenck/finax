import { createFileRoute } from '@tanstack/react-router'
import { FormCustomer } from './-components/form-customer'

export const Route = createFileRoute(
  '/_app/registers/customers/create',
)({
  component: CreateCustomer,
})

function CreateCustomer() {
  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cadastrar Cliente</h1>
          <span className='text-xs text-muted-foreground'>Preencha os dados para cadastrar um novo cliente.</span>
        </div>
      </header>

      <FormCustomer />
    </main>
  )
}
