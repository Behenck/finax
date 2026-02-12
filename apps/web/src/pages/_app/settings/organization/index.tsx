import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useApp } from '@/context/app-context'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Building, ExternalLinkIcon, MapPin, Users } from 'lucide-react'

export const Route = createFileRoute('/_app/settings/organization/')({
  component: OrganizationPage,
})

function OrganizationPage() {
  const { organization } = useApp()

  return (
    <div className='space-y-8'>
      <div className='flex gap-4'>
        <Card className='flex flex-row gap-4 p-6 flex-1'>
          <div className='p-3 rounded-lg bg-green-50 text-green-600 flex items-center justify-center'>
            <Building />
          </div>
          <div className='flex flex-col'>
            <span className='font-bold text-2xl'>3</span>
            <span className='text-xs'>Empresas</span>
          </div>
        </Card>
        <Card className='flex flex-row gap-4 p-6 flex-1'>
          <div className='p-3 rounded-lg bg-green-50 text-green-600 flex items-center justify-center'>
            <MapPin />
          </div>
          <div className='flex flex-col'>
            <span className='font-bold text-2xl'>3</span>
            <span className='text-xs'>Unidades</span>
          </div>
        </Card>
        <Card className='flex flex-row gap-4 p-6 flex-1'>
          <div className='p-3 rounded-lg bg-green-50 text-green-600 flex items-center justify-center'>
            <Users />
          </div>
          <div className='flex flex-col'>
            <span className='font-bold text-2xl'>3</span>
            <span className='text-xs'>Membros</span>
          </div>
        </Card>
      </div >
      <Card className='p-6'>
        <div>
          <h2 className='text-2xl font-semibold'>Dados da Organização</h2>
          <span className='text-xs text-muted-foreground'>Informações da organização em que você está logado</span>
        </div>

        <form className='space-y-4'>
          <div className='flex gap-4'>
            <FieldGroup>
              <Field className='gap-1'>
                <FieldLabel>Nome</FieldLabel>
                <Input placeholder='' value={organization?.name} />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field className='gap-1'>
                <FieldLabel>CNPJ</FieldLabel>
                <Input placeholder='12.345.678/0001-90' />
              </Field>
            </FieldGroup>
          </div>
          <div className='flex gap-4'>
            <FieldGroup>
              <Field className='gap-1'>
                <FieldLabel>Email</FieldLabel>
                <Input placeholder='contato@email.com' />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field className='gap-1'>
                <FieldLabel>Telefone</FieldLabel>
                <Input placeholder='(55) 9999-0000' />
              </Field>
            </FieldGroup>
          </div>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Site</FieldLabel>
              <div className='flex gap-2 items-center'>
                <Input placeholder='https://www.arkogrupo.com.br' />
                <Button variant="outline" className='flex-1'>
                  <Link to='/'>
                    <ExternalLinkIcon />
                  </Link>
                </Button>
              </div>
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Endereço</FieldLabel>
              <Input placeholder='Duque de caxias, 2234 -  Uruguaiana/RS' />
            </Field>
          </FieldGroup>
          <Button>Salvar alterações</Button>
        </form>
      </Card>
    </div >
  )
}
