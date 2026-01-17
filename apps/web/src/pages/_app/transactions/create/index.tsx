import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_app/transactions/create/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className='space-y-6'>
      <header className='flex gap-6 items-center'>
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to='/transactions'>
          <ArrowLeft className='size-4' />
          </Link>
        </Button>
        <div className='flex flex-col gap-1'>
          <h1 className='text-2xl font-bold'>Nova Transação</h1>
          <span className='text-gray-500 text-sm'>Adicione uma nova receita ou despesa</span>
        </div>
      </header>

      <div className='space-y-6'>
        <Card className='p-5 rounded-sm gap-3'>
          <Label className='font-semibold'>Tipo de Transação</Label>
          <div className='flex gap-3'>
            <Button variant="outline" className='flex flex-col items-center justify-center gap-1 p-10 flex-1'>
              <span className='text-gray-600'>Despesa</span>
              <span className='text-xs text-gray-500 font-light'>Saida de dinheiro</span>
            </Button>
            <Button variant="outline" className='flex flex-col items-center justify-center p-10 flex-1'>
              <span className='text-gray-600'>Receita</span>
              <span className='text-xs text-gray-500 font-light'>Entrada de dinheiro</span>
            </Button>
          </div>
          <div className='flex gap-3'>
            <Button variant="outline" className='flex flex-col items-center justify-center gap-1 p-4 flex-1'>
            <span className='text-gray-600 text-xs font-normal'>Fixa</span>
            </Button>
            <Button variant="outline" className='flex flex-col items-center justify-center p-4 flex-1'>
              <span className='text-gray-600 text-xs font-normal'>Variável</span>
            </Button>
          </div>
        </Card>
        <Card className='p-5 rounded-sm gap-5'>
          <Label className='font-semibold'>Informações Básicas</Label>
          <Field>
            <Label>Descrição *</Label>
            <Input
              placeholder='Ex: Aluguel do escritório'
            />
          </Field>
          <div className='flex gap-3'>
            <FieldGroup>
              <Field>
                <Label>Data de Vencimento *</Label>
                <Input
                  placeholder='Ex: Aluguel do escritório'
              />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field>
                <Label>Previsão de Pagamento *</Label>
                <Input
                  placeholder='Ex: Aluguel do escritório'
              />
              </Field>
            </FieldGroup>
          </div>
        </Card>
      </div>
    </main>
  )
}
