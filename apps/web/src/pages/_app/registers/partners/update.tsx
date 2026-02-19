import { createFileRoute } from '@tanstack/react-router'
import { FormPartner } from './-components/form-partner'
import z from 'zod';
import { useApp } from '@/context/app-context';
import { useGetOrganizationsSlugPartnersPartnerid } from '@/http/generated';

const updatePartnerSearchSchema = z.object({
  partnerId: z.uuid(),
});

export const Route = createFileRoute('/_app/registers/partners/update')({
  validateSearch: (search) => updatePartnerSearchSchema.parse(search),
  component: UpdatePartner,
})

function UpdatePartner() {
  const { partnerId } = Route.useSearch();
  const { organization } = useApp()

  const { data } = useGetOrganizationsSlugPartnersPartnerid({
    slug: organization!.slug,
    partnerId
  })

  if (!data?.partner) {
    return <span>Carregando...</span>
  }

  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Atualizar Parceiro</h1>
          <span className='text-xs text-muted-foreground'>Preencha os dados para atualizar os dados do parceiro.</span>
        </div>
      </header>

      <FormPartner type='UPDATE' partner={data.partner} />
    </main>)
}
