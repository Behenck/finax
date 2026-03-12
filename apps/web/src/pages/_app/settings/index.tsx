import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Card className='mx-auto w-full max-w-3xl gap-6 p-4 sm:p-6'>
      <div>
        <h2 className='text-xl font-bold sm:text-2xl'>Preferências Gerais</h2>
        <span className='text-muted-foreground text-xs'>Configure as preferências gerais do sistema</span>
      </div>

      <form className='space-y-6'>
        <FieldGroup>
          <Field className='gap-1'>
            <FieldLabel>Nome do Sistema</FieldLabel>
            <Input placeholder='Finax' />
          </Field>
        </FieldGroup>
        <FieldGroup>
          <Field className='gap-1'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <FieldLabel className='text-md'>Notificações por e-mail</FieldLabel>
                <span className='text-sm text-muted-foreground'>Receber notificações de atividades importantes</span>
              </div>
              <Switch />
            </div>
          </Field>
        </FieldGroup>
        <FieldGroup>
          <Field className='gap-1'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <FieldLabel className='text-md'>Modo escuro</FieldLabel>
                <span className='text-sm text-muted-foreground'>Alternar entre tema claro e escuro</span>
              </div>
              <Switch />
            </div>
          </Field>
        </FieldGroup>

        <Button className='w-full sm:w-auto'>Salvar Preferências</Button>
      </form>
    </Card>
  )
}
